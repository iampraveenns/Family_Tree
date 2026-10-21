import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HeritageMemberNode, HeritageMemberNodeData } from '../src/components/genealogy/HeritageMemberNode.tsx';
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

describe('Phase 50: Family Tree - Living (Circle Line + Inner Circle, No Text) & Death (Gray Circle)', () => {
  const livingMember: FamilyMember = {
    id: 'mem-living-pattara',
    familyId: 'fam-1',
    firstName: 'Ravi',
    lastName: 'Pattara',
    displayName: 'Ravi Pattara',
    gender: 'MALE',
    isLiving: true,
    generation: 2,
    dateOfBirth: '1985-05-20',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const deceasedMember: FamilyMember = {
    id: 'mem-deceased-pattara',
    familyId: 'fam-1',
    firstName: 'Senior',
    lastName: 'Pattara',
    displayName: 'Senior Pattara',
    gender: 'MALE',
    isLiving: false,
    dateOfDeath: '2020-04-10',
    generation: 1,
    dateOfBirth: '1945-02-15',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const spouseMemberLiving: FamilyMember = {
    id: 'spouse-living',
    familyId: 'fam-1',
    firstName: 'Ananya',
    lastName: 'Pattara',
    displayName: 'Ananya Pattara',
    gender: 'FEMALE',
    isLiving: true,
    generation: 2,
    dateOfBirth: '1988-11-12',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const spouseMemberDeceased: FamilyMember = {
    id: 'spouse-deceased',
    familyId: 'fam-1',
    firstName: 'Lakshmi',
    lastName: 'Pattara',
    displayName: 'Lakshmi Pattara',
    gender: 'FEMALE',
    isLiving: false,
    dateOfDeath: '2022-08-30',
    generation: 1,
    dateOfBirth: '1950-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('1. Living member: removes visible text living, keeps inner circle, and outer line is a circle', () => {
    const data: HeritageMemberNodeData = {
      member: livingMember,
      isSelected: false,
      isFocused: false,
      isDimmed: false,
      isHovered: false,
    };

    const html = renderToString(<HeritageMemberNode data={data} id="node-living" {...({} as any)} />);

    // Circular indicator container
    expect(html).toContain('data-testid="life-status-indicator-mem-living-pattara"');
    expect(html).toContain('w-[21px]');
    expect(html).toContain('h-[21px]');
    expect(html).toContain('rounded-full');
    expect(html).toContain('border-[#86EFAC]');
    expect(html).toContain('bg-[#DCFCE7]');

    // Inner circle
    expect(html).toContain('bg-[#16A34A]');
    expect(html).toContain('w-2 h-2 rounded-full');

    // No visible text "Living" (only in sr-only or accessible attributes)
    expect(html).not.toMatch(/<span[^>]*class="[^"]*whitespace-nowrap[^"]*"[^>]*>\s*Living\s*<\/span>/);
    expect(html).toContain('<span class="sr-only">Living</span>');
  });

  it('2. Deceased / Death member: same circular shape with outer circle line and inner circle, colored gray', () => {
    const data: HeritageMemberNodeData = {
      member: deceasedMember,
      isSelected: false,
      isFocused: false,
      isDimmed: false,
      isHovered: false,
    };

    const html = renderToString(<HeritageMemberNode data={data} id="node-deceased" {...({} as any)} />);

    // Circular indicator container with same shape
    expect(html).toContain('data-testid="life-status-indicator-mem-deceased-pattara"');
    expect(html).toContain('w-[21px]');
    expect(html).toContain('h-[21px]');
    expect(html).toContain('rounded-full');

    // Gray colors for outer line, background, and inner circle
    expect(html).toContain('border-[#CBD5E1]');
    expect(html).toContain('bg-[#F1F5F9]');
    expect(html).toContain('bg-[#64748B]');
    expect(html).toContain('w-2 h-2 rounded-full');

    // No visible text RIP (only in sr-only)
    expect(html).not.toMatch(/<span[^>]*class="[^"]*whitespace-nowrap font-bold[^"]*"[^>]*>\s*RIP\s*<\/span>/);
    expect(html).toContain('class="sr-only"');
    expect(html).toContain('data-testid="rip-badge-mem-deceased-pattara"');
  });

  it('3. Applies identical circular status indicators to spouses (both living and deceased)', () => {
    // Living spouse
    const livingSpouseHtml = renderToString(
      <HeritageMemberNode
        data={{
          member: spouseMemberLiving,
          isSelected: false,
          isFocused: false,
          isDimmed: false,
          isHovered: false,
          isSecondarySpouse: true,
        }}
      />
    );
    expect(livingSpouseHtml).toContain('data-testid="life-status-indicator-spouse-living"');
    expect(livingSpouseHtml).toContain('rounded-full');
    expect(livingSpouseHtml).toContain('bg-[#16A34A]');
    expect(livingSpouseHtml).not.toMatch(/<span[^>]*class="[^"]*whitespace-nowrap[^"]*"[^>]*>\s*Living\s*<\/span>/);

    // Deceased spouse
    const deceasedSpouseHtml = renderToString(
      <HeritageMemberNode
        data={{
          member: spouseMemberDeceased,
          isSelected: false,
          isFocused: false,
          isDimmed: false,
          isHovered: false,
          isSecondarySpouse: true,
        }}
      />
    );
    expect(deceasedSpouseHtml).toContain('data-testid="life-status-indicator-spouse-deceased"');
    expect(deceasedSpouseHtml).toContain('rounded-full');
    expect(deceasedSpouseHtml).toContain('bg-[#64748B]');
    expect(deceasedSpouseHtml).toContain('border-[#CBD5E1]');
  });
});
