'use strict';

const { getClientForRequest } = require('../../middleware/rbac');
const logger = require('../../utils/logger');

// GET / (Public - anyone can list categories)
exports.listCategories = async (req, res) => {
  try {
    const client = getClientForRequest(req);
    const { data, error } = await client
      .from('exam_categories')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error listing exam categories:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /:slug
exports.getCategory = async (req, res) => {
  try {
    const { slug } = req.params;
    const client = getClientForRequest(req);
    const { data, error } = await client
      .from('exam_categories')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Category not found' });

    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error fetching exam category:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST / (Admin only)
exports.createCategory = async (req, res) => {
  try {
    const { name, slug, icon, display_order } = req.body;
    if (!name || !slug) return res.status(400).json({ success: false, error: 'Name and slug are required' });

    const client = getClientForRequest(req);
    const { data, error } = await client
      .from('exam_categories')
      .insert([{ name, slug, icon, display_order }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) {
    logger.error('Error creating exam category:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// PATCH /:id (Admin only)
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const client = getClientForRequest(req);
    const { data, error } = await client
      .from('exam_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    logger.error('Error updating exam category:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /:id (Admin only)
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const client = getClientForRequest(req);
    const { error } = await client
      .from('exam_categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    logger.error('Error deleting exam category:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
