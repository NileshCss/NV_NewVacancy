import { supabase } from './supabase'

function toErrorMessage(error, fallback = 'Request failed') {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (error?.message) return error.message
  return fallback
}

async function invokeAIAssistant(action, payload = {}, prompt = null) {
  const body = {
    action,
    payload,
  }

  if (prompt) {
    body.prompt = prompt
  }

  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body,
  })

  if (error) {
    throw new Error(toErrorMessage(error, 'AI edge function call failed'))
  }

  if (!data?.success) {
    throw new Error(data?.error || 'AI edge function returned an error')
  }

  return data.response
}

async function createActivityLog(payload) {
  try {
    const { data } = await supabase
      .from('ai_activity_log')
      .insert(payload)
      .select('id')
      .maybeSingle()

    return data?.id || null
  } catch {
    return null
  }
}

async function updateActivityLog(logId, payload) {
  if (!logId) return

  try {
    await supabase.from('ai_activity_log').update(payload).eq('id', logId)
  } catch {
    // no-op
  }
}

export async function scrapeURL(url) {
  if (!url?.trim()) {
    throw new Error('URL is required')
  }

  const response = await invokeAIAssistant('scrape_url', {
    url: url.trim(),
  })

  if (!response?.content) {
    throw new Error('Failed to scrape readable content from URL')
  }

  return response
}

export async function extractJobDataWithAI(scrapedContent, sourceUrl) {
  if (!scrapedContent?.trim()) {
    throw new Error('Scraped content is required for extraction')
  }

  if (!sourceUrl?.trim()) {
    throw new Error('Source URL is required for extraction')
  }

  const response = await invokeAIAssistant('extract_job', {
    scraped_content: scrapedContent,
    source_url: sourceUrl,
  })

  if (!response?.title || !response?.organization) {
    throw new Error('AI could not extract valid job details')
  }

  return response
}

export async function uploadJobToSupabase(jobData, adminId) {
  if (!jobData?.source_url) {
    throw new Error('jobData.source_url is required')
  }

  const logId = await createActivityLog({
    admin_id: adminId || null,
    action_type: 'extract_and_upload',
    action: 'extract_and_upload',
    input_data: { source_url: jobData.source_url },
    status: 'processing',
  })

  try {
    const { data: existingJob, error: existingError } = await supabase
      .from('jobs')
      .select('id')
      .eq('source_url', jobData.source_url)
      .maybeSingle()

    if (existingError) {
      throw existingError
    }

    let savedJob
    let action = 'created'

    if (existingJob?.id) {
      const { data, error } = await supabase
        .from('jobs')
        .update({
          ...jobData,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingJob.id)
        .select()
        .single()

      if (error) {
        throw error
      }

      savedJob = data
      action = 'updated'
    } else {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          ...jobData,
          created_by: adminId || null,
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      savedJob = data
    }

    await updateActivityLog(logId, {
      status: 'success',
      output_data: {
        action,
        job_id: savedJob?.id,
      },
      job_id: savedJob?.id || null,
      completed_at: new Date().toISOString(),
    })

    return {
      ...savedJob,
      action,
    }
  } catch (error) {
    await updateActivityLog(logId, {
      status: 'failed',
      error_message: toErrorMessage(error),
      completed_at: new Date().toISOString(),
    })

    throw new Error(toErrorMessage(error, 'Failed to upload extracted job'))
  }
}

export async function processAdminInstruction(instruction, jobs, adminId) {
  if (!instruction?.trim()) {
    throw new Error('Instruction is required')
  }

  const jobList = Array.isArray(jobs) ? jobs : []

  const logId = await createActivityLog({
    admin_id: adminId || null,
    action_type: 'date_extension',
    action: 'process_instruction',
    prompt: instruction.trim(),
    input_data: {
      instruction: instruction.trim(),
      jobs_count: jobList.length,
    },
    status: 'processing',
  })

  try {
    const operations = await invokeAIAssistant('process_instruction', {
      instruction: instruction.trim(),
      jobs: jobList,
    })

    if (!Array.isArray(operations) || operations.length === 0) {
      await updateActivityLog(logId, {
        status: 'success',
        output_data: { operations: [] },
        completed_at: new Date().toISOString(),
      })
      return []
    }

    const today = new Date().toISOString().slice(0, 10)
    const results = []

    for (const operation of operations) {
      try {
        const { data: currentJob, error: fetchError } = await supabase
          .from('jobs')
          .select('*')
          .eq('id', operation.job_id)
          .maybeSingle()

        if (fetchError) {
          throw fetchError
        }

        if (!currentJob) {
          results.push({
            job_id: operation.job_id,
            job_title: operation.job_title || 'Unknown job',
            success: false,
            error: 'Job not found',
          })
          continue
        }

        const historyEntry = {
          date: today,
          instruction: instruction.trim(),
          note: operation.extension_note || operation.reason || 'Updated via AI instruction',
          changes: operation.updates || {},
          admin_id: adminId || null,
        }

        const history = Array.isArray(currentJob.extension_history) ? currentJob.extension_history : []
        const basePayload = {
          ...operation.updates,
          updated_at: new Date().toISOString(),
        }

        let { data: updatedJob, error: updateError } = await supabase
          .from('jobs')
          .update({
            ...basePayload,
            extension_history: [...history, historyEntry],
          })
          .eq('id', operation.job_id)
          .select()
          .single()

        if (updateError && String(updateError?.message || '').toLowerCase().includes('extension_history')) {
          const fallbackResult = await supabase
            .from('jobs')
            .update(basePayload)
            .eq('id', operation.job_id)
            .select()
            .single()

          updatedJob = fallbackResult.data
          updateError = fallbackResult.error
        }

        if (updateError) {
          throw updateError
        }

        results.push({
          job_id: operation.job_id,
          job_title: operation.job_title || updatedJob?.title || 'Updated job',
          updates: operation.updates,
          reason: operation.reason || 'Updated via instruction',
          success: true,
        })
      } catch (error) {
        results.push({
          job_id: operation.job_id,
          job_title: operation.job_title || 'Unknown job',
          success: false,
          error: toErrorMessage(error),
        })
      }
    }

    await updateActivityLog(logId, {
      status: 'success',
      output_data: { operations: results },
      completed_at: new Date().toISOString(),
    })

    return results
  } catch (error) {
    await updateActivityLog(logId, {
      status: 'failed',
      error_message: toErrorMessage(error),
      completed_at: new Date().toISOString(),
    })

    throw new Error(toErrorMessage(error, 'Failed to process instruction'))
  }
}

export async function getExpiringJobs() {
  const today = new Date().toISOString().slice(0, 10)
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const { data: expired, error: expiredError } = await supabase
    .from('jobs')
    .select('*')
    .eq('is_active', true)
    .not('last_date', 'is', null)
    .lt('last_date', today)
    .order('last_date', { ascending: false })

  if (expiredError) {
    throw new Error(toErrorMessage(expiredError, 'Failed to load expired jobs'))
  }

  const { data: expiringSoon, error: expiringError } = await supabase
    .from('jobs')
    .select('*')
    .eq('is_active', true)
    .not('last_date', 'is', null)
    .gte('last_date', today)
    .lte('last_date', in7Days)
    .order('last_date', { ascending: true })

  if (expiringError) {
    throw new Error(toErrorMessage(expiringError, 'Failed to load expiring jobs'))
  }

  return {
    expired: expired || [],
    expiringSoon: expiringSoon || [],
  }
}
