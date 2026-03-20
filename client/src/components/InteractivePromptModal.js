import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const InteractivePromptModal = ({ prompt, onResponse, onClose }) => {
  const [selectedRegion, setSelectedRegion] = useState(
    prompt.suggestedRegions?.[0] || 'West US'
  );
  const [customInput, setCustomInput] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleAction = async (actionId) => {
    setProcessing(true);
    
    const userInput = {};
    
    // Prepare user input based on action
    if (actionId === 'select_region') {
      userInput.region = selectedRegion;
    } else if (actionId === 'provide_custom_name') {
      userInput.customName = customInput;
    } else if (actionId === 'change_sku') {
      userInput.sku = 'Free';
    }
    
    try {
      await onResponse(actionId, userInput);
    } catch (error) {
      console.error('Failed to handle prompt response:', error);
      setProcessing(false);
    }
  };

  const getActionButton = (action) => {
    const needsInput = action.requiresInput;
    const disabled = needsInput && !customInput && action.id === 'provide_custom_name';
    
    return (
      <motion.button
        key={action.id}
        onClick={() => handleAction(action.id)}
        disabled={processing || disabled}
        className={`
          w-full px-6 py-4 rounded-xl font-medium text-left
          transition-all duration-200 flex items-center gap-3
          ${processing || disabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : action.id === 'skip_resource' || action.id === 'abort'
            ? 'bg-red-50 hover:bg-red-100 text-red-700 border-2 border-red-200'
            : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-2 border-blue-200 hover:border-blue-300'
          }
        `}
        whileHover={!processing && !disabled ? { scale: 1.02 } : {}}
        whileTap={!processing && !disabled ? { scale: 0.98 } : {}}
      >
        <span className="text-2xl">{action.icon}</span>
        <div className="flex-1">
          <div className="font-semibold">{action.label}</div>
        </div>
        {processing && (
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        )}
      </motion.button>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && !processing && onClose?.()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
            <div className="flex items-start gap-4">
              <div className="text-4xl">⚠️</div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">{prompt.title}</h2>
                <p className="text-orange-50">{prompt.description}</p>
              </div>
            </div>
          </div>

          {/* Original Error Details */}
          <div className="p-6 bg-red-50 border-b border-red-100">
            <details className="cursor-pointer">
              <summary className="font-semibold text-red-800 mb-2">
                📋 Original Error Details
              </summary>
              <pre className="text-xs bg-white p-3 rounded-lg border border-red-200 overflow-x-auto text-red-700 whitespace-pre-wrap">
                {prompt.originalError}
              </pre>
            </details>
          </div>

          {/* Region Selector (if applicable) */}
          {prompt.errorType === 'region_unavailable' && (
            <div className="p-6 border-b border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                🌍 Select Alternative Region:
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                disabled={processing}
              >
                {prompt.suggestedRegions?.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm text-gray-600">
                💡 These regions are currently available for resource creation
              </p>
            </div>
          )}

          {/* Custom Name Input (if applicable) */}
          {prompt.errorType === 'name_conflict' && (
            <div className="p-6 border-b border-gray-200">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                ✏️ Provide Custom Name (optional):
              </label>
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Enter unique resource name..."
                className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                disabled={processing}
              />
              <p className="mt-2 text-sm text-gray-600">
                💡 Leave empty to auto-generate a unique name
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Choose Recovery Action:
            </h3>
            <div className="space-y-3">
              {prompt.actions.map((action) => getActionButton(action))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="text-lg">💡</span>
              <p>
                {prompt.errorType === 'region_unavailable'
                  ? 'Region availability changes frequently. Your selection will be applied immediately.'
                  : prompt.errorType === 'quota_exceeded'
                  ? 'Changing SKU or region may help avoid quota limits.'
                  : 'You can skip this resource and continue with others, or try a different approach.'}
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InteractivePromptModal;

