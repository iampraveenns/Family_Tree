import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 53: 4-Branch Horizontal Scroll and Memories Slider Symbol Removal', () => {
  const familyTreePagePath = path.resolve(__dirname, '../src/pages/family/FamilyTreePage.tsx');
  const familyTreePageContent = fs.readFileSync(familyTreePagePath, 'utf-8');

  describe('1. Right Memories slider button and toolbar button symbols removed', () => {
    it('verifies floating-memories-tab-button does not contain any Sparkles or icon symbol', () => {
      // Find the right memories slider tab button
      const floatingSliderMatch = familyTreePageContent.match(/data-testid="floating-memories-tab-button"[\s\S]*?<\/button>/);
      expect(floatingSliderMatch).toBeTruthy();
      const buttonContent = floatingSliderMatch![0];

      // Must NOT contain Sparkles or any icon component
      expect(buttonContent).not.toContain('<Sparkles');
      expect(buttonContent).not.toContain('FolderHeart');
      expect(buttonContent).not.toContain('<svg');

      // Must contain Memories text and count
      expect(buttonContent).toContain('Memories ({memories.length})');
    });

    it('verifies toolbar toggle-memories-sidebar-button does not contain any Sparkles or icon symbol', () => {
      // Find the toolbar memories button
      const toolbarBtnMatch = familyTreePageContent.match(/data-testid="toggle-memories-sidebar-button"[\s\S]*?<\/button>/);
      expect(toolbarBtnMatch).toBeTruthy();
      const toolbarContent = toolbarBtnMatch![0];

      // Must NOT contain Sparkles or any icon component
      expect(toolbarContent).not.toContain('<Sparkles');
      expect(toolbarContent).not.toContain('FolderHeart');

      // Must contain text and count
      expect(toolbarContent).toContain('<span>Memories</span>');
    });
  });

  describe('2. Branches list does not expand and has left/right scroll showing 4 branches including All Branches', () => {
    it('verifies branches-scroll-container is horizontally scrollable with constrained width for 4 branches', () => {
      expect(familyTreePageContent).toContain('data-testid="branches-scroll-container"');
      
      // Must have overflow-x-auto and fixed/constrained width (w-[430px]) so it does not expand unbounded
      expect(familyTreePageContent).toMatch(/data-testid="branches-scroll-container"[^>]*overflow-x-auto/);
      expect(familyTreePageContent).toMatch(/data-testid="branches-scroll-container"[^>]*w-\[430px\]/);
      expect(familyTreePageContent).toMatch(/data-testid="branches-scroll-container"[^>]*scroll-smooth/);
    });

    it('verifies left and right scroll buttons exist for branch browsing/searching', () => {
      expect(familyTreePageContent).toContain('data-testid="branch-scroll-left-button"');
      expect(familyTreePageContent).toContain('data-testid="branch-scroll-right-button"');

      // Left button triggers handleScrollBranches('left')
      expect(familyTreePageContent).toContain("handleScrollBranches('left')");
      // Right button triggers handleScrollBranches('right')
      expect(familyTreePageContent).toContain("handleScrollBranches('right')");
    });

    it('verifies All Branches is the first item followed by dynamic branches with shrink-0', () => {
      expect(familyTreePageContent).toContain('data-testid="branch-tab-all"');
      expect(familyTreePageContent).toContain('All Branches');
      // Branch buttons must have shrink-0 and whitespace-nowrap so they do not wrap or squash
      expect(familyTreePageContent).toMatch(/data-testid="branch-tab-all"[^>]*shrink-0/);
      expect(familyTreePageContent).toMatch(/data-testid="branch-tab-all"[^>]*whitespace-nowrap/);
    });
  });
});
