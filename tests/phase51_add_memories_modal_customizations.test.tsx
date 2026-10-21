import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { UploadNodeMemoryModal } from '../src/components/genealogy/UploadNodeMemoryModal.tsx';
import { MemoryRouter } from 'react-router-dom';
import { FamilyMember } from '../src/types/index.ts';

describe('Phase 51: Add Memories Popup Tab Customizations', () => {
  const patriarchMember: FamilyMember = {
    id: 'govindan-1',
    familyId: 'fam-pattara-1',
    firstName: 'Govindan',
    lastName: 'Pattara',
    displayName: 'Patriarch Govindan Pattara',
    gender: 'MALE',
    isLiving: false,
    dateOfBirth: '1920-01-01',
    generation: 1,
  };

  it('renders "Add Memories" as heading instead of "Upload Memories for Patriarch Govindan Pattara"', () => {
    const html = renderToString(
      <MemoryRouter>
        <UploadNodeMemoryModal
          isOpen={true}
          member={patriarchMember}
          familyId="fam-pattara-1"
          onClose={() => {}}
        />
      </MemoryRouter>
    );

    // Title should be "Add Memories"
    expect(html).toContain('Add Memories');
    expect(html).not.toContain('Upload Memories for Patriarch Govindan Pattara');
  });

  it('removes the yellow background and yellow outline banner section next to the heading', () => {
    const html = renderToString(
      <MemoryRouter>
        <UploadNodeMemoryModal
          isOpen={true}
          member={patriarchMember}
          familyId="fam-pattara-1"
          onClose={() => {}}
        />
      </MemoryRouter>
    );

    // Banner removed
    expect(html).not.toContain('Preserve in Family Memories:');
    expect(html).not.toContain('bg-[#FEF08A]/45');
    expect(html).not.toContain('border-[#FDE047]');
  });

  it('changes "Date or Year (Optional)" to "Date" with an HTML5 datepicker (type="date")', () => {
    const html = renderToString(
      <MemoryRouter>
        <UploadNodeMemoryModal
          isOpen={true}
          member={patriarchMember}
          familyId="fam-pattara-1"
          onClose={() => {}}
        />
      </MemoryRouter>
    );

    // Label should be "Date", not "Date or Year (Optional)"
    expect(html).toContain('<span>Date</span>');
    expect(html).not.toContain('Date or Year (Optional)');

    // Input should be a datepicker (type="date")
    expect(html).toContain('type="date"');
    expect(html).toContain('id="memory-event-date"');
  });

  it('supports photos, videos, and audios in the input labels, accept attributes, and helper texts', () => {
    const html = renderToString(
      <MemoryRouter>
        <UploadNodeMemoryModal
          isOpen={true}
          member={patriarchMember}
          familyId="fam-pattara-1"
          onClose={() => {}}
        />
      </MemoryRouter>
    );

    // Label specifies Photo, Video, or Audio
    expect(html).toContain('Select Photo, Video, or Audio');

    // Drag-and-drop area specifies photos, videos, or audios
    expect(html).toContain('Drag and drop photos, videos, or audios here');

    // Hidden file input accepts image/*,video/*,audio/*
    expect(html).toContain('accept="image/*,video/*,audio/*"');

    // Helper text lists audio formats
    expect(html).toContain('Supports photos, videos, and audios');

    // Submit button label
    expect(html).toContain('Add to Memories');
  });

  it('removes the Heritage Collection input field from the Memories popup', () => {
    const html = renderToString(
      <MemoryRouter>
        <UploadNodeMemoryModal
          isOpen={true}
          member={patriarchMember}
          familyId="fam-pattara-1"
          onClose={() => {}}
        />
      </MemoryRouter>
    );

    // Heritage Collection input field removed
    expect(html).not.toContain('Heritage Collection');
    expect(html).not.toContain('Includes in Memories Collections');
    expect(html).not.toContain('General Family Memories');
  });
});
