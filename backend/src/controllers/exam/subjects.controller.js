'use strict';

const { getClientForRequest } = require('../../middleware/rbac');
const logger = require('../../utils/logger');

// GET /
exports.listSubjects = async (req, res) => {
  try {
    const { exam_id } = req.query;
    if (!exam_id) return res.status(400).json({ success: false, error: 'exam_id is required' });

    const client = getClientForRequest(req);

    let query = client
      .from('subjects')
      .select('*')
      .eq('exam_id', exam_id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
      query = query.eq('enabled', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error listing subjects:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /
exports.createSubject = async (req, res) => {
  try {
    const { exam_id, name, icon, image_url, display_order, enabled } = req.body;
    if (!exam_id || !name) return res.status(400).json({ success: false, error: 'exam_id and name are required' });

    const client = getClientForRequest(req);
    const { data, error } = await client
      .from('subjects')
      .insert([{ exam_id, name, icon, image_url, display_order, enabled: enabled !== false }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    logger.error('Error creating subject:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// PATCH /:id
exports.updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const client = getClientForRequest(req);
    const { data, error } = await client
      .from('subjects')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error updating subject:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /:id
exports.deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const client = getClientForRequest(req);
    const { error } = await client
      .from('subjects')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true, message: 'Subject deleted' });
  } catch (err) {
    logger.error('Error deleting subject:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// PATCH /reorder
exports.reorderSubjects = async (req, res) => {
  try {
    const { items } = req.body; // array of { id, display_order }
    if (!Array.isArray(items)) return res.status(400).json({ success: false, error: 'items array is required' });

    const client = getClientForRequest(req);
    const promises = items.map(item => 
      client.from('subjects').update({ display_order: item.display_order }).eq('id', item.id)
    );
    await Promise.all(promises);

    res.json({ success: true, message: 'Reordered successfully' });
  } catch (err) {
    logger.error('Error reordering subjects:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
