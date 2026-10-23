import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import { MemoriesSidePanel, VideoMemoryCardPlayer } from '../src/components/genealogy/MemoriesSidePanel.tsx';
import { FamilyMemoriesSidebar } from '../src/components/genealogy/FamilyMemoriesSidebar.tsx';
import { MediaDetailLightboxModal } from '../src/components/genealogy/MediaDetailLightboxModal.tsx';
import { UploadNodeMemoryModal } from '../src/components/genealogy/UploadNodeMemoryModal.tsx';
import { Memory, FamilyMember } from '../src/types/index.ts';
import { MemoryType } from '../server/src/constants/index.ts';

describe('Phase 56: Video Memory Storage, Rendering & Media Player Workflow', () => {
  const sidePanelPath = path.resolve(__dirname, '../src/components/genealogy/MemoriesSidePanel.tsx');
  const uploadModalPath = path.resolve(__dirname, '../src/components/genealogy/UploadNodeMemoryModal.tsx');
  const mediaRoutesPath = path.resolve(__dirname, '../server/src/routes/memoryRoutes.ts');

  const sidePanelContent = fs.readFileSync(sidePanelPath, 'utf-8');
  const uploadModalContent = fs.readFileSync(uploadModalPath, 'utf-8');
  const mediaRoutesContent = fs.readFileSync(mediaRoutesPath, 'utf-8');

  const mockMember: FamilyMember = {
    id: 'member-1',
    familyId: 'fam-1',
    firstName: 'Dev',
    lastName: 'Pattara',
    displayName: 'Dev Pattara',
    gender: 'MALE',
    isLiving: true,
    generation: 2,
    createdAt: '2026-01-01',
  };

  const mockVideoMemory: Memory = {
    id: 'mem-video-1',
    familyId: 'fam-1',
    title: 'Heritage Courtyard Dance',
    description: 'Rare family video recording from the annual harvest festival.',
    memoryType: 'VIDEO',
    addedByMemberId: 'member-1',
    addedByMemberName: 'Dev Pattara',
    mediaUrl: 'https://example.com/dance.mp4',
    coverMediaUrl: 'https://example.com/dance.mp4',
    media: [
      {
        id: 'asset-vid-1',
        familyId: 'fam-1',
        memoryId: 'mem-video-1',
        originalFileName: 'dance.mp4',
        mimeType: 'video/mp4',
        fileSize: 10485760,
        streamUrl: 'https://example.com/dance.mp4',
        processingStatus: 'READY',
        visibility: 'FAMILY',
        createdAt: '2026-10-21T00:00:00.000Z',
      },
    ],
    eventDate: '2024-08-20T00:00:00.000Z',
    eventDateApprox: 'August 2024',
    location: 'Palakkad Ancestral House',
    visibility: 'FAMILY',
    memberIds: ['member-1'],
    branchIds: [],
    tags: ['dance', 'video', 'festival'],
    status: 'ACTIVE',
    createdAt: '2026-10-21T00:00:00.000Z',
  };

  describe('1. Storage & Persistence Schema for Videos', () => {
    it('verifies MemoryType enum contains VIDEO', () => {
      expect(MemoryType.VIDEO).toBe('VIDEO');
    });

    it('verifies UploadNodeMemoryModal classifies video uploads with memoryType: VIDEO', () => {
      expect(uploadModalContent).toContain("memoryType = 'VIDEO'");
      expect(uploadModalContent).toMatch(/accept=.*video\/mp4.*video\/webm.*video\/quicktime/);
    });

    it('verifies backend memoryRoutes parses and sets memoryType to VIDEO for video payloads', () => {
      expect(mediaRoutesContent).toContain("declaredType = MemoryType.VIDEO");
      expect(mediaRoutesContent).toContain("req.file.mimetype.startsWith('video/')");
    });
  });

  describe('2. Video Rendering & UI Layout with HTML5 <video>', () => {
    it('renders interactive HTML5 <video> element on video cards instead of plain text descriptions', () => {
      const html = renderToString(
        <MemoriesSidePanel
          isOpen={true}
          onClose={() => {}}
          memories={[mockVideoMemory]}
          members={[mockMember]}
          onOpenUploadModal={() => {}}
        />
      );

      // Card must be present
      expect(html).toContain('data-testid="memory-card-mem-video-1"');
      // Video player element must be rendered
      expect(html).toContain('data-testid="video-card-player-mem-video-1"');
      expect(html).toContain('<video');
      expect(html).toContain('src="https://example.com/dance.mp4"');
    });

    it('renders HTML5 <video> element with muted attribute for hover autoplay', () => {
      const playerHtml = renderToString(
        <VideoMemoryCardPlayer
          memory={mockVideoMemory}
          onOpenFullView={() => {}}
        />
      );

      expect(playerHtml).toContain('<video');
      expect(playerHtml).toContain('muted=""');
      expect(playerHtml.toLowerCase()).toContain('playsinline');
    });

    it('renders HTML5 <video> in FamilyMemoriesSidebar', () => {
      const html = renderToString(
        <FamilyMemoriesSidebar
          isOpen={true}
          onClose={() => {}}
          memories={[mockVideoMemory]}
          members={[mockMember]}
          onOpenUploadModal={() => {}}
        />
      );

      expect(html).toContain('data-testid="video-card-player-mem-video-1"');
      expect(html).toContain('<video');
    });
  });

  describe('3. Hover-to-Play Autoplay Implementation', () => {
    it('verifies onMouseEnter and onMouseLeave event handlers and muted property are coded on video card', () => {
      expect(sidePanelContent).toContain('onMouseEnter={handleMouseEnter}');
      expect(sidePanelContent).toContain('onMouseLeave={handleMouseLeave}');
      expect(sidePanelContent).toContain('videoRef.current.play()');
      expect(sidePanelContent).toContain('videoRef.current.pause()');
      expect(sidePanelContent).toContain('videoRef.current.muted = true');
    });
  });

  describe('4. Full-View Modal / Lightbox Option for Videos', () => {
    it('renders Open Full View button on video cards', () => {
      const playerHtml = renderToString(
        <VideoMemoryCardPlayer
          memory={mockVideoMemory}
          onOpenFullView={() => {}}
        />
      );

      expect(playerHtml).toContain('Open Full View');
      expect(playerHtml).toContain('aria-label="Open Full View"');
    });

    it('renders modal displaying full resolution video with standard controls', () => {
      const modalHtml = renderToString(
        <MediaDetailLightboxModal
          isOpen={true}
          onClose={() => {}}
          memory={mockVideoMemory}
          members={[mockMember]}
        />
      );

      expect(modalHtml).toContain('<video');
      expect(modalHtml).toContain('controls=""');
      expect(modalHtml).toContain('src="https://example.com/dance.mp4"');
    });
  });
});
