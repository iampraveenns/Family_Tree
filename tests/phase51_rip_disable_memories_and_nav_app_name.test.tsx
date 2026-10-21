import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { HeritageMemberNode, HeritageMemberNodeData } from '../src/components/genealogy/HeritageMemberNode.tsx';
import { AppLayout } from '../src/layouts/AppLayout.tsx';
import { UploadNodeMemoryModal } from '../src/components/genealogy/UploadNodeMemoryModal.tsx';
import { FamilyMember } from '../src/types/index.ts';

// Mock reactflow Handle & Position
vi.mock('reactflow', () => ({
  Handle: ({ id, type, position, className }: any) => (
    <div data-testid={`handle-${type}-${position}-${id || 'default'}`} className={className} />
  ),
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
}));

describe('Phase 51: RIP Disable Memories Button, Nav Bar Family Name Removal & FamilyTree App Name', () => {
  const livingMember: FamilyMember = {
    id: 'mem-living-1',
    familyId: 'fam-1',
    firstName: 'Devan',
    lastName: 'Pattara',
    displayName: 'Devan Pattara',
    gender: 'MALE',
    isLiving: true,
    generation: 2,
    dateOfBirth: '1985-05-20',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const deceasedMember: FamilyMember = {
    id: 'mem-rip-1',
    familyId: 'fam-1',
    firstName: 'Patriarch',
    lastName: 'Govindan',
    displayName: 'Patriarch Govindan Pattara',
    gender: 'MALE',
    isLiving: false,
    dateOfDeath: '2015-08-12',
    generation: 1,
    dateOfBirth: '1930-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('1. When a person is RIP, the Memories button is disabled in both popup editbar and bottom action bar', () => {
    const ripData: HeritageMemberNodeData = {
      member: deceasedMember,
      isSelected: true,
      isFocused: false,
      isDimmed: false,
      isHovered: false,
      hasSpouse: false,
      isSecondarySpouse: false,
    };

    const html = renderToString(<HeritageMemberNode data={ripData} />);

    // Bottom action bar memories button is disabled
    expect(html).toContain('data-testid="node-memories-btn-mem-rip-1"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('cursor-not-allowed opacity-40');
    expect(html).toContain('Memories disabled for deceased person');

    // Top hover/selected popup editbar button is disabled
    expect(html).toContain('data-testid="node-popup-editbar-mem-rip-1"');
    expect(html).toContain('title="Memories disabled for deceased person (Patriarch Govindan Pattara)"');
  });

  it('2. When a person is living, the Memories button is enabled and active', () => {
    const livingData: HeritageMemberNodeData = {
      member: livingMember,
      isSelected: true,
      isFocused: false,
      isDimmed: false,
      isHovered: false,
      hasSpouse: true,
      isSecondarySpouse: false,
    };

    const html = renderToString(<HeritageMemberNode data={livingData} />);

    // Bottom action bar memories button is NOT disabled
    expect(html).toContain('data-testid="node-memories-btn-mem-living-1"');
    expect(html).not.toMatch(/data-testid="node-memories-btn-mem-living-1"[^>]*disabled=""/);
    expect(html).toContain('cursor-pointer');

    // Top hover/selected popup editbar button is enabled
    expect(html).toContain('title="Upload Memories (Photos/Videos)"');
  });

  it('3. AppLayout navigation bar removes family name and displays FamilyTree as application name', () => {
    const html = renderToString(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    );

    // Displays FamilyTree as application name
    expect(html).toContain('FamilyTree');
    expect(html).not.toContain('FamilyRoots');

    // Family name near application name is completely removed
    expect(html).not.toContain('data-testid="nav-family-name"');
  });

  it('4. UploadNodeMemoryModal has Add Memories heading, datepicker Date, and no Heritage Collection', () => {
    const html = renderToString(
      <MemoryRouter>
        <UploadNodeMemoryModal
          isOpen={true}
          member={livingMember}
          familyId="fam-1"
          onClose={() => {}}
        />
      </MemoryRouter>
    );

    // Heading is Add Memories (not Upload Memories for...)
    expect(html).toContain('Add Memories');
    expect(html).not.toContain('Upload Memories for');

    // Yellow background callout is removed
    expect(html).not.toContain('bg-[#FEF08A]/45');

    // Date datepicker is present
    expect(html).toContain('id="memory-event-date"');
    expect(html).toContain('type="date"');
    expect(html).toContain('<span>Date</span>');
    expect(html).not.toContain('Date or Year (Optional)');

    // Heritage Collection field is removed
    expect(html).not.toContain('Heritage Collection');
    expect(html).not.toContain('collection-name');

    // Supports photos, videos, and audios
    expect(html).toContain('Select Photo, Video, or Audio');
    expect(html).toContain('accept="image/*,video/*,audio/*"');
  });
});
