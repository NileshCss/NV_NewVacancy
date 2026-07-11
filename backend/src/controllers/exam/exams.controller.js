'use strict';

const { supabaseAdmin, supabaseRegular } = require('../../middleware/rbac');
const logger = require('../../utils/logger');

// GET / (Public - gets only published. Admins can pass ?all=true to get all via admin route if needed, but we'll use RLS)
exports.listExams = async (req, res) => {
  try {
    const { category_id } = req.query;
    
    // We use the regular client. RLS policy "public read published exams" will restrict
    // non-admins to status = 'published'.
    // BUT we need to ensure admin can see all if they pass their token.
    // However, if the token is passed, supabaseRegular handles it.
    const client = req.user && ['admin', 'super_admin'].includes(req.user.role) 
        ? supabaseAdmin 
        : supabaseRegular;

    let query = client
      .from('exams')
      .select('*, exam_categories(name, slug)')
      .order('created_at', { ascending: false });

    if (category_id) {
      query = query.eq('category_id', category_id);
    }
    
    // If not admin, explicitly filter published just in case RLS isn't fully robust
    if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
      query = query.eq('status', 'published');
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error listing exams:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /:slug
exports.getExam = async (req, res) => {
  try {
    const { slug } = req.params;
    const client = req.user && ['admin', 'super_admin'].includes(req.user.role) 
        ? supabaseAdmin 
        : supabaseRegular;

    const { data, error } = await client
      .from('exams')
      .select('*, exam_categories(name, slug)')
      .eq('slug', slug)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Exam not found' });

    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error fetching exam:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST / (Admin only)
exports.createExam = async (req, res) => {
  try {
    const { category_id, name, slug, description, eligibility, age_limit, selection_process, exam_pattern, logo_url, banner_url, status } = req.body;
    
    if (!name || !slug || !category_id) {
      return res.status(400).json({ success: false, error: 'Name, slug, and category_id are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('exams')
      .insert([{ 
        category_id, name, slug, description, eligibility, age_limit, 
        selection_process, exam_pattern, logo_url, banner_url, 
        status: status || 'draft',
        created_by: req.user.id
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    logger.error('Error creating exam:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// PATCH /:id (Admin only)
exports.updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body, updated_at: new Date().toISOString() };

    const { data, error } = await supabaseAdmin
      .from('exams')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error updating exam:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /:id (Admin only)
exports.deleteExam = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('exams')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true, message: 'Exam deleted' });
  } catch (err) {
    logger.error('Error deleting exam:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// PATCH /:id/publish (Admin only)
exports.publishExam = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('exams')
      .update({ status: 'published', published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error publishing exam:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// PATCH /:id/archive (Admin only)
exports.archiveExam = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('exams')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error archiving exam:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
