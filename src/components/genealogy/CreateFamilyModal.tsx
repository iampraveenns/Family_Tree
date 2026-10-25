import React, { useState } from 'react';
import { Sparkles, MapPin, Quote, FileText, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal.tsx';
import { Input } from '../ui/Input.tsx';
import { Button } from '../ui/Button.tsx';
import { useFamilyStore } from '../../stores/useFamilyStore.ts';
import { useToastStore } from '../../stores/useToastStore.ts';
import { Family } from '../../types/index.ts';

interface CreateFamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (family: Family) => void;
}

export const CreateFamilyModal: React.FC<CreateFamilyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { createFamilyVault } = useFamilyStore();
  const { success } = useToastStore();

  const [name, setName] = useState('');
  const [originPlace, setOriginPlace] = useState('');
  const [motto, setMotto] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!name.trim()) {
      setErrorMessage('Family tree name is required to establish your vault.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const newFamily = await createFamilyVault({
        name: name.trim(),
        originPlace: originPlace.trim() || undefined,
        motto: motto.trim() || undefined,
        description: description.trim() || undefined,
      });

      success(`Family Tree "${newFamily.name}" established successfully!`, 'Tree Created');

      // Clear form only on success
      setName('');
      setOriginPlace('');
      setMotto('');
      setDescription('');
      onClose();

      if (onSuccess) {
        onSuccess(newFamily);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to establish family tree vault. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setErrorMessage(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Establish New Family Tree"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-[#64748B]">
          Establish a dedicated family tree vault to preserve your lineage, memories, and ancestral stories.
        </p>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#475569] mb-1">
            Family Tree Name <span className="text-red-500">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., The Kumar Family Tree or Pattara Family Chronicle"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#475569] mb-1">
            Ancestral Place of Origin
          </label>
          <Input
            value={originPlace}
            onChange={(e) => setOriginPlace(e.target.value)}
            placeholder="e.g., Varanasi & New Delhi, India"
            leftIcon={<MapPin className="w-4 h-4 text-[#64748B]" />}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#475569] mb-1">
            Family Motto or Guiding Principle
          </label>
          <Input
            value={motto}
            onChange={(e) => setMotto(e.target.value)}
            placeholder='e.g., "Roots in the Earth, Branches to the Sky"'
            leftIcon={<Quote className="w-4 h-4 text-[#64748B]" />}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#475569] mb-1">
            Heritage Overview / Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-xs rounded-xl border border-[#E2E8F0] bg-white text-[#0F172A] focus:ring-2 focus:ring-[#2563EB] focus:border-transparent outline-hidden resize-none"
            placeholder="A brief history, origin background, or purpose of this heritage vault..."
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E2E8F0]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            isLoading={isSubmitting}
            leftIcon={<Sparkles className="w-3.5 h-3.5" />}
          >
            Establish Vault
          </Button>
        </div>
      </form>
    </Modal>
  );
};
