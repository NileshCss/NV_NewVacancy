'use strict';

const { supabaseAdmin, supabaseRegular } = require('../../middleware/rbac');
const logger = require('../../utils/logger');

exports.listChapters = async (req, res) => {
  try {
    const { subject_id } = req.query;
    if (!subject_id) return res.status(400).json({ success: false, error: 'subject_id is required' });

    const client = req.user && ['admin', 'super_admin'].includes(req.user.role) 
        ? supabaseAdmin 
        : supabaseRegular;

    const { data, error } = await client
      .from('chapters')
      .select('*')
      .eq('subject_id', subject_id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error listing chapters:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.createChapter = async (req, res) => {
  try {
    const { subject_id, name, display_order } = req.body;
    if (!subject_id || !name) return res.status(400).json({ success: false, error: 'subject_id and name are required' });

    const { data, error } = await supabaseAdmin
      .from('chapters')
      .insert([{ subject_id, name, display_order }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    logger.error('Error creating chapter:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateChapter = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('chapters')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error updating chapter:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteChapter = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('chapters')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true, message: 'Chapter deleted' });
  } catch (err) {
    logger.error('Error deleting chapter:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.reorderChapters = async (req, res) => {
  try {
    const { items } = req.body; 
    if (!Array.isArray(items)) return res.status(400).json({ success: false, error: 'items array is required' });

    const promises = items.map(item => 
      supabaseAdmin.from('chapters').update({ display_order: item.display_order }).eq('id', item.id)
    );
    await Promise.all(promises);

    res.json({ success: true, message: 'Reordered successfully' });
  } catch (err) {
    logger.error('Error reordering chapters:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
