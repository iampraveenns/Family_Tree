import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HeritageMemberNode, HeritageMemberNodeData } from '../src/components/genealogy/HeritageMemberNode.tsx';
import { AddMemberModal } from '../src/components/genealogy/AddMemberModal.tsx';
import { AppLayout } from '../src/layouts/AppLayout.tsx';
import { FamilyMember } from '../src/types/index.ts';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Outlet: () => <div data-testid="outlet" />,
}));

// Mock reactflow
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
  useReactFlow: () => ({
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitView: vi.fn(),
  }),
}));

describe('Phase 48: Spouse DOM Compulsory, DOM Color Matching & Nav Header Update', () => {
  const primaryMemberWithSpouse: FamilyMember = {
    id: 'mem-primary-dom-test',
    familyId: 'fam-dom-test',
    firstName: 'Anand',
    lastName: 'Pattara',
    displayName: 'Anand Pattara',
    gender: 'MALE',
    dateOfBirth: '1950-01-01',
    dateOfMarriage: '1975-06-15',
    marriageDate: '1975-06-15',
    isLiving: true,
    location: 'Palakkad, Kerala',
    generation: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('1. DOM is displayed in the exact same color (#17233C) as Location and DOB', () => {
    const data: HeritageMemberNodeData = {
      member: primaryMemberWithSpouse,
      isSelected: false,
      isFocused: false,
      isDimmed: false,
      isHovered: false,
      hasSpouse: true,
      marriageDate: '1975-06-15',
      isSecondarySpouse: false,
    };

    const html = renderToString(<HeritageMemberNode data={data} id="node-dom-test" {...({} as any)} />);

    // DOB is rendered in text-[#17233C]
    expect(html).toContain('DOB: 1 Jan 1950');
    expect(html).toContain('class="truncate whitespace-nowrap text-[#17233C]" title="DOB: 1 Jan 1950"');

    // Location is rendered in text-[#17233C]
    expect(html).toContain('Location: Palakkad, Kerala');
    expect(html).toContain('data-testid="node-location-mem-primary-dom-test" class="truncate whitespace-nowrap text-[#17233C]"');

    // DOM is rendered in text-[#17233C] (NOT blue text-[#2563EB])
    expect(html).toContain('DOM: 15 Jun 1975');
    expect(html).toContain('data-testid="node-dom-mem-primary-dom-test" class="truncate whitespace-nowrap text-[#17233C]"');
    expect(html).not.toContain('text-[#2563EB]" title="DOM:');
  });

  it('2. AppLayout top nav bar removes Pattara Family dropdown selector and renders FamilyTree brand', () => {
    const html = renderToString(<AppLayout />);

    // Brand is FamilyTree and sign out button are present
    expect(html).toContain('FamilyTree');
    expect(html).not.toContain('FamilyRoots');
    expect(html).toContain('Sign Out');

    // Family name dropdown and family name badge are removed from top nav bar
    expect(html).not.toContain('Select Family Vault');
    expect(html).not.toContain('data-testid="nav-family-name"');
  });

  it('3. AddMemberModal marks Marriage Date (DOM) as required and compulsory when relationshipType is SPOUSE', () => {
    const html = renderToString(
      <AddMemberModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        isRootAncestor={false}
        referenceMember={primaryMemberWithSpouse}
        referenceMemberHasSpouse={false}
        initialRelationshipType="SPOUSE"
      />
    );

    // Label specifies compulsory marriage date
    expect(html).toContain('Marriage Date (DOM) *');
    expect(html).toContain('id="marriage-date-(dom)-*"');
    expect(html).toContain('required=""');
  });
});
