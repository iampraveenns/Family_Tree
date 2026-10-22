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

describe('Phase 51: Node Memory Button Removal & Direct Sidebar Flow, Nav Bar Family Name Removal', () => {
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

  it('1. When a person is RIP, the node does not display any Memory button (managed directly via sidebar)', () => {
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

    // Bottom action bar does not contain memories button
    expect(html).not.toContain('data-testid="node-memories-btn-mem-rip-1"');
    expect(html).not.toContain('+ Memories');

    // Top popup editbar does not contain memories button
    expect(html).toContain('data-testid="node-popup-editbar-mem-rip-1"');
    expect(html).not.toContain('title="Upload Memories (Photos/Videos)"');
  });

  it('2. When a person is living, the node does not display Memory button (managed directly via sidebar)', () => {
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

    // Bottom action bar does not contain memories button
    expect(html).not.toContain('data-testid="node-memories-btn-mem-living-1"');
    expect(html).not.toContain('+ Memories');

    // Top popup editbar does not contain memories button
    expect(html).toContain('data-testid="node-popup-editbar-mem-living-1"');
    expect(html).not.toContain('title="Upload Memories (Photos/Videos)"');
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

  it('4. UploadNodeMemoryModal has Add Memory heading, datepicker Date, and supports photos/videos/audios', () => {
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

    // Heading is Add Memory
    expect(html).toContain('Add Memory');

    // Date datepicker is present
    expect(html).toContain('id="memory-event-date"');
    expect(html).toContain('type="date"');
    expect(html).toContain('<span>Date (Optional)</span>');

    // Supports photos, videos, and audios
    expect(html).toContain('Upload Photo, Video, or Audio');
    expect(html).toContain('accept="image/*,video/*,audio/*"');
  });
});
