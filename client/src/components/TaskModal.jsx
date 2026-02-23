import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const priorityConfig = {
  critical: { label: 'Critical', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  high: { label: 'High', bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  medium: { label: 'Medium', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  low: { label: 'Low', bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' }
};

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

  const today = new Date().toISOString().split('T')[0];
  const currentPriority = priorityConfig[formData.priority] || priorityConfig.medium;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)' }}
    >
      {/* Backdrop click handler */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal */}
      <div 
        className="relative w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#ffffff' }}
      >
        {/* Header with gradient */}
        <div 
          className="px-6 py-5"
          style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {isCreating ? 'Create New Task' : canEdit ? 'Edit Task' : 'View Task'}
                </h3>
                {!isCreating && task && (
                  <p className="text-blue-100 text-sm">Task #{task.id?.slice(-6)}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-all duration-200 hover:bg-white/20"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div 
            className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto"
            style={{ backgroundColor: '#ffffff' }}
          >
            {/* Error message */}
            {errors.submit && (
              <div className="p-4 rounded-xl flex items-start gap-3" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm" style={{ color: '#dc2626' }}>{errors.submit}</p>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1e293b' }}>
                Task Title <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                disabled={!canEdit}
                placeholder="What needs to be done?"
                className="w-full px-4 py-3 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: canEdit ? '#f8fafc' : '#f1f5f9',
                  color: '#1e293b',
                  border: errors.title ? '2px solid #dc2626' : '2px solid #e2e8f0'
                }}
              />
              {errors.title && (
                <p className="mt-2 text-sm flex items-center gap-1" style={{ color: '#dc2626' }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                  </svg>
                  {errors.title}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1e293b' }}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                disabled={!canEdit}
                placeholder="Add more details about this task..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed resize-none"
                style={{ 
                  backgroundColor: canEdit ? '#f8fafc' : '#f1f5f9',
                  color: '#1e293b',
                  border: '2px solid #e2e8f0'
                }}
              />
            </div>

            {/* Priority & Deadline row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Priority */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#1e293b' }}>
                  Priority <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.priority}
                    onChange={(e) => handleChange('priority', e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-4 py-3 rounded-xl appearance-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed pr-10"
                    style={{ 
                      backgroundColor: currentPriority.bg,
                      color: currentPriority.color,
                      border: `2px solid ${currentPriority.border}`,
                      fontWeight: 600
                    }}
                  >
                    {Object.entries(priorityConfig).map(([value, config]) => (
                      <option key={value} value={value}>{config.label}</option>
                    ))}
                  </select>
                  <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: currentPriority.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#1e293b' }}>
                  Deadline <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => handleChange('deadline', e.target.value)}
                  disabled={!canEdit}
                  min={today}
                  className="w-full px-4 py-3 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
                  style={{ 
                    backgroundColor: canEdit ? '#f8fafc' : '#f1f5f9',
                    color: '#1e293b',
                    border: errors.deadline ? '2px solid #dc2626' : '2px solid #e2e8f0'
                  }}
                />
                {errors.deadline && (
                  <p className="mt-2 text-sm" style={{ color: '#dc2626' }}>{errors.deadline}</p>
                )}
              </div>
            </div>

            {/* Linked PR */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1e293b' }}>
                Link Pull Request
              </label>
              <div className="relative">
                <div 
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center"
                  style={{ backgroundColor: '#e2e8f0' }}
                >
                  <span style={{ color: '#64748b', fontWeight: 600, fontSize: '12px' }}>#</span>
                </div>
                <input
                  type="number"
                  value={formData.linkedPR}
                  onChange={(e) => handleChange('linkedPR', e.target.value)}
                  disabled={!canEdit}
                  placeholder="Enter PR number"
                  min="1"
                  className="w-full pl-12 pr-4 py-3 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
                  style={{ 
                    backgroundColor: canEdit ? '#f8fafc' : '#f1f5f9',
                    color: '#1e293b',
                    border: '2px solid #e2e8f0'
                  }}
                />
              </div>
              <p className="mt-2 text-xs flex items-center gap-1" style={{ color: '#64748b' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Task will auto-complete when the linked PR is merged
              </p>
            </div>

            {/* Labels */}
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#1e293b' }}>
                Labels
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLabel())}
                  disabled={!canEdit}
                  placeholder="Type label and press Enter"
                  className="flex-1 px-4 py-3 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed"
                  style={{ 
                    backgroundColor: canEdit ? '#f8fafc' : '#f1f5f9',
                    color: '#1e293b',
                    border: '2px solid #e2e8f0'
                  }}
                />
                <button
                  type="button"
                  onClick={addLabel}
                  disabled={!canEdit || !labelInput.trim()}
                  className="px-5 py-3 font-semibold rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ 
                    backgroundColor: '#e2e8f0',
                    color: '#475569'
                  }}
                >
                  Add
                </button>
              </div>
              {formData.labels.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {formData.labels.map((label, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg"
                      style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}
                    >
                      {label}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removeLabel(label)}
                          className="hover:opacity-70 transition-opacity"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div 
                className="p-4 rounded-xl space-y-2"
                style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
              >
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4" style={{ color: '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span style={{ color: '#64748b' }}>Created by</span>
                  <span className="font-semibold" style={{ color: '#1e293b' }}>@{task.createdBy}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4" style={{ color: '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span style={{ color: '#64748b' }}>Status:</span>
                  <span 
                    className="px-2 py-0.5 rounded-md text-xs font-semibold capitalize"
                    style={{ backgroundColor: '#e2e8f0', color: '#475569' }}
                  >
                    {task.column.replace('_', ' ')}
                  </span>
                </div>
                {task.flagged && (
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#dc2626' }}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" />
                    </svg>
                    Task is overdue!
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div 
            className="px-6 py-4 flex items-center justify-between"
            style={{ backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}
          >
            {/* Delete button */}
            {task && !isCreating && canEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 hover:bg-red-50"
                style={{ color: '#dc2626' }}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </span>
              </button>
            ) : <div />}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50"
                style={{ backgroundColor: '#e2e8f0', color: '#475569' }}
              >
                {canEdit ? 'Cancel' : 'Close'}
              </button>
              {canEdit && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  style={{ 
                    background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
                  }}
                >
                  {isSubmitting && (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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
