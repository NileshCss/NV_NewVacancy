'use strict';

const { supabaseAdmin, supabaseRegular, getClientForRequest } = require('../../middleware/rbac');
const logger = require('../../utils/logger');

exports.listTopics = async (req, res) => {
  try {
    const { chapter_id } = req.query;
    if (!chapter_id) return res.status(400).json({ success: false, error: 'chapter_id is required' });

    const client = getClientForRequest(req);

    const { data, error } = await client
      .from('topics')
      .select('*')
      .eq('chapter_id', chapter_id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error listing topics:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const client = getClientForRequest(req);

    const { data, error } = await client
      .from('topics')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Topic not found' });

    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error fetching topic:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createTopic = async (req, res) => {
  try {
    const { chapter_id, name, description, notes_rich_text, formula, diagrams, interview_tips, revision_notes, important_points, pdf_url, display_order } = req.body;
    if (!chapter_id || !name) return res.status(400).json({ success: false, error: 'chapter_id and name are required' });

    const client = getClientForRequest(req);

    const { data, error } = await client
      .from('topics')
      .insert([{ 
        chapter_id, name, description, notes_rich_text, formula, 
        diagrams: diagrams || [], interview_tips, revision_notes, 
        important_points, pdf_url, display_order 
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    logger.error('Error creating topic:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    const client = getClientForRequest(req);

    const { data, error } = await client
      .from('topics')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error updating topic:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const client = getClientForRequest(req);

    const { error } = await client
      .from('topics')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true, message: 'Topic deleted' });
  } catch (err) {
    logger.error('Error deleting topic:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.reorderTopics = async (req, res) => {
  try {
    const { items } = req.body; 
    if (!Array.isArray(items)) return res.status(400).json({ success: false, error: 'items array is required' });

    const client = getClientForRequest(req);

    const promises = items.map(item => 
      client.from('topics').update({ display_order: item.display_order }).eq('id', item.id)
    );
    await Promise.all(promises);

    res.json({ success: true, message: 'Reordered successfully' });
  } catch (err) {
    logger.error('Error reordering topics:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
