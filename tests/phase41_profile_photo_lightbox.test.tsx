import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HeritageMemberNode, HeritageMemberNodeData } from '../src/components/genealogy/HeritageMemberNode.tsx';
import { ProfilePhotoLightboxModal } from '../src/components/genealogy/ProfilePhotoLightboxModal.tsx';
import { FamilyMember } from '../src/types/index.ts';

// Mock reactflow Handle component
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

describe('Phase 41: FamilyRoots — Profile Photo Full-Size View from Family Tree Node', () => {
  const memberWithPhoto: FamilyMember = {
    id: 'mem-photo-1',
    familyId: 'fam-test-1',
    firstName: 'Suresh',
    lastName: 'Pattara',
    displayName: 'Suresh Pattara',
    gender: 'MALE',
    isLiving: true,
    dateOfBirth: '1984-09-30',
    dateOfMarriage: null,
    dateOfDeath: null,
    generation: 2,
    branchName: 'Suresh Branch',
    profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const memberWithoutPhoto: FamilyMember = {
    id: 'mem-nophoto-2',
    familyId: 'fam-test-1',
    firstName: 'Anita',
    lastName: 'Pattara',
    displayName: 'Anita Pattara',
    gender: 'FEMALE',
    isLiving: true,
    dateOfBirth: '1986-11-15',
    dateOfMarriage: null,
    dateOfDeath: null,
    generation: 2,
    branchName: 'Suresh Branch',
    profilePhoto: '',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  describe('1. Member Node Avatar Trigger & View Profile Picture Menu', () => {
    it('renders a clickable button with zoom hover and accessible label when member has a custom profile photo', () => {
      const nodeData: HeritageMemberNodeData = {
        member: memberWithPhoto,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
      };

      const html = renderToString(<HeritageMemberNode data={nodeData} id="node-1" {...({} as any)} />);

      // Must have interactive trigger with accessible label
      expect(html).toContain('aria-label="View photo options for Suresh Pattara"');
      expect(html).toContain('title="View photo options for Suresh Pattara"');
      expect(html).toContain('cursor-pointer');
      expect(html).toContain('hover:scale-105');
      // Must contain image URL
      expect(html).toContain('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800');
    });

    it('does NOT make avatar clickable when member has no custom photo (default avatar placeholder)', () => {
      const nodeData: HeritageMemberNodeData = {
        member: memberWithoutPhoto,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
      };

      const html = renderToString(<HeritageMemberNode data={nodeData} id="node-2" {...({} as any)} />);

      // Should NOT have the photo options trigger
      expect(html).not.toContain('aria-label="View photo options for Anita Pattara"');
      expect(html).not.toContain('title="View photo options for Anita Pattara"');
      // Should render default avatar SVG without photo viewer button
      expect(html).toContain('Female profile avatar');
    });

    it('includes aria-haspopup="true" on photo options trigger for custom photos', () => {
      const nodeData: HeritageMemberNodeData = {
        member: memberWithPhoto,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
      };

      const html = renderToString(<HeritageMemberNode data={nodeData} id="node-1" {...({} as any)} />);
      expect(html).toContain('aria-haspopup="true"');
      expect(html).toContain('aria-expanded="false"');
    });

    it('keeps Eye icon separate for viewing member profile', () => {
      const nodeData: HeritageMemberNodeData = {
        member: memberWithPhoto,
        isSelected: false,
        isFocused: false,
        isDimmed: false,
        isHovered: false,
      };

      const html = renderToString(<HeritageMemberNode data={nodeData} id="node-1" {...({} as any)} />);

      // Eye icon for Profile Drawer is present and distinct
      expect(html).toContain('title="View Profile"');
      expect(html).toContain('aria-label="View Profile"');
    });
  });

  describe('2. ProfilePhotoLightboxModal Layout & Presentation', () => {
    it('renders centered modal with full image, member caption, accessible close button, and dark backdrop', () => {
      const html = renderToString(
        <ProfilePhotoLightboxModal
          isOpen={true}
          onClose={() => {}}
          member={memberWithPhoto}
          photoUrl={memberWithPhoto.profilePhoto!}
        />
      );

      // Dialog accessibility
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-label="Full profile photo of Suresh Pattara"');

      // Close button with aria-label
      expect(html).toContain('aria-label="Close profile picture"');

      // Image with original aspect preservation and object-contain
      expect(html).toContain('src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800"');
      expect(html).toContain('object-contain');
      expect(html).toContain('max-h-[75vh]');

      // Caption with member full name
      expect(html).toContain('Suresh Pattara');
      expect(html).toContain('Suresh Branch');

      // Dark backdrop styling
      expect(html).toContain('rgba(15, 23, 42, 0.75)');
      expect(html).toContain('backdrop-blur-[5px]');
    });

    it('returns null or empty when isOpen is false', () => {
      const html = renderToString(
        <ProfilePhotoLightboxModal
          isOpen={false}
          onClose={() => {}}
          member={memberWithPhoto}
          photoUrl={memberWithPhoto.profilePhoto!}
        />
      );

      expect(html).not.toContain('role="dialog"');
      expect(html).not.toContain('Full profile photo of Suresh Pattara');
    });
  });
});
