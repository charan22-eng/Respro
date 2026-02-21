import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const priorityOptions = [
  { value: 'critical', label: 'Critical', color: 'text-red-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
  { value: 'medium', label: 'Medium', color: 'text-blue-600' },
  { value: 'low', label: 'Low', color: 'text-gray-600' }
];

function TaskModal({ task, isOpen, onClose, onSave, onDelete, currentUser, isCreating }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    deadline: '',
    labels: [],
    linkedPR: ''
  });
  const [labelInput, setLabelInput] = useState('');
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form when task changes or modal opens for editing
  useEffect(() => {
    if (task && !isCreating) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'medium',
        deadline: task.deadline ? task.deadline.split('T')[0] : '',
        labels: task.labels || [],
        linkedPR: task.linkedPR?.toString() || ''
      });
    } else if (isCreating) {
      // Default deadline to 7 days from now for new tasks
      const defaultDeadline = new Date();
      defaultDeadline.setDate(defaultDeadline.getDate() + 7);
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        deadline: defaultDeadline.toISOString().split('T')[0],
        labels: [],
        linkedPR: ''
      });
    }
    setErrors({});
  }, [task, isCreating, isOpen]);

  if (!isOpen) return null;

  const isOwner = isCreating || (task && task.createdBy === currentUser);
  const canEdit = isOwner;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const addLabel = () => {
    const label = labelInput.trim();
    if (label && !formData.labels.includes(label)) {
      setFormData(prev => ({ ...prev, labels: [...prev.labels, label] }));
      setLabelInput('');
    }
  };

  const removeLabel = (labelToRemove) => {
    setFormData(prev => ({
      ...prev,
      labels: prev.labels.filter(l => l !== labelToRemove)
    }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.deadline) newErrors.deadline = 'Deadline is required';
    else {
      const deadlineDate = new Date(formData.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      deadlineDate.setHours(0, 0, 0, 0);
      if (deadlineDate < today) newErrors.deadline = 'Deadline cannot be in the past';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const dataToSave = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        deadline: formData.deadline,
        labels: formData.labels,
        linkedPR: formData.linkedPR ? parseInt(formData.linkedPR, 10) : null
      };
      await onSave(dataToSave);
      onClose();
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    setIsSubmitting(true);
    try {
      await onDelete(task.id);
      onClose();
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get min date for deadline picker (today)
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {isCreating ? 'Create New Task' : canEdit ? 'Edit Task' : 'View Task'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Error message */}
            {errors.submit && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {errors.submit}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                disabled={!canEdit}
                placeholder="Enter task title"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pulse-500 focus:border-pulse-500 disabled:bg-gray-100 ${errors.title ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                disabled={!canEdit}
                placeholder="Describe the task..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-500 focus:border-pulse-500 disabled:bg-gray-100 resize-none"
              />
            </div>

            {/* Priority & Deadline row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => handleChange('priority', e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-500 focus:border-pulse-500 disabled:bg-gray-100"
                >
                  {priorityOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deadline <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => handleChange('deadline', e.target.value)}
                  disabled={!canEdit}
                  min={today}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pulse-500 focus:border-pulse-500 disabled:bg-gray-100 ${errors.deadline ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.deadline && <p className="mt-1 text-xs text-red-600">{errors.deadline}</p>}
              </div>
            </div>

            {/* Linked PR */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Linked PR Number
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">#</span>
                <input
                  type="number"
                  value={formData.linkedPR}
                  onChange={(e) => handleChange('linkedPR', e.target.value)}
                  disabled={!canEdit}
                  placeholder="123"
                  min="1"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-500 focus:border-pulse-500 disabled:bg-gray-100"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">Task will auto-move when PR is merged</p>
            </div>

            {/* Labels */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Labels
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLabel())}
                  disabled={!canEdit}
                  placeholder="Add a label"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pulse-500 focus:border-pulse-500 disabled:bg-gray-100"
                />
                <button
                  type="button"
                  onClick={addLabel}
                  disabled={!canEdit || !labelInput.trim()}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
              </div>
              {formData.labels.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.labels.map((label, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2 py-1 bg-pulse-100 text-pulse-700 text-sm rounded"
                    >
                      {label}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removeLabel(label)}
                          className="ml-1 text-pulse-500 hover:text-pulse-700"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Task metadata (view only) */}
            {task && !isCreating && (
              <div className="pt-4 border-t border-gray-200 text-sm text-gray-500 space-y-1">
                <p>Created by <span className="font-medium text-gray-700">@{task.createdBy}</span></p>
                <p>Status: <span className="font-medium text-gray-700 capitalize">{task.column.replace('_', ' ')}</span></p>
                {task.flagged && (
                  <p className="text-red-600 font-medium flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" />
                    </svg>
                    This task has been flagged as overdue
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              {/* Delete button (only for owner editing existing task) */}
              {task && !isCreating && canEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  Delete Task
                </button>
              )}
              {(!task || !canEdit || isCreating) && <div />}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  {canEdit ? 'Cancel' : 'Close'}
                </button>
                {canEdit && (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-pulse-600 hover:bg-pulse-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center"
                  >
                    {isSubmitting && (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isCreating ? 'Create Task' : 'Save Changes'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

TaskModal.propTypes = {
  task: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    column: PropTypes.string,
    priority: PropTypes.string,
    deadline: PropTypes.string,
    assignee: PropTypes.string,
    createdBy: PropTypes.string,
    labels: PropTypes.arrayOf(PropTypes.string),
    linkedPR: PropTypes.number,
    flagged: PropTypes.bool
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func,
  currentUser: PropTypes.string.isRequired,
  isCreating: PropTypes.bool
};

export default TaskModal;
