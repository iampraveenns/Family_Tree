import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Search,
  Plus,
  X,
  Calendar,
  MapPin,
  Briefcase,
  GitFork,
  Check,
  User,
  Heart,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  ImageIcon,
  Camera,
  Pencil,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useFamilyStore } from '../../stores/useFamilyStore.ts';
import { useMemoryStore } from '../../stores/useMemoryStore.ts';
import { useTimelineStore } from '../../stores/useTimelineStore.ts';
import { useToastStore } from '../../stores/useToastStore.ts';
import { FamilyMember } from '../../types/index.ts';
import { MemberAvatar } from '../../components/ui/MemberAvatar.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Modal } from '../../components/ui/Modal.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { EmptyState } from '../../components/ui/EmptyState.tsx';
import { authenticatedFetch } from '../../utils/api.ts';

import { HeritageMemberNode, getNodeDateRows, formatSingleDate } from '../../components/genealogy/HeritageMemberNode.tsx';
import { CoupleJunctionNode, formatMarriageDate } from '../../components/genealogy/CoupleJunctionNode.tsx';
import { GenerationMarkerNode } from '../../components/genealogy/GenerationMarkerNode.tsx';
import { StarterMemberNode } from '../../components/genealogy/StarterMemberNode.tsx';
import { TreeFloatingControls } from '../../components/genealogy/TreeFloatingControls.tsx';
import { AddMemberModal, MemberFormData } from '../../components/genealogy/AddMemberModal.tsx';
import { EditLifeStatusModal } from '../../components/genealogy/EditLifeStatusModal.tsx';
import { CreateFamilyModal } from '../../components/genealogy/CreateFamilyModal.tsx';
import { ProfilePhotoLightboxModal } from '../../components/genealogy/ProfilePhotoLightboxModal.tsx';
import { UploadNodeMemoryModal } from '../../components/genealogy/UploadNodeMemoryModal.tsx';
import { MemoriesSidePanel } from '../../components/genealogy/MemoriesSidePanel.tsx';
import { formatFamilyDisplayName } from '../../utils/mediaUtils.ts';
import { calculateTreeLayout } from '../../utils/treeLayout.ts';

// Registered React Flow Custom Nodes
const nodeTypes = {
  heritageMember: HeritageMemberNode,
  coupleJunction: CoupleJunctionNode,
  generationMarker: GenerationMarkerNode,
  starterNode: StarterMemberNode,
};

// Inner Family Tree Canvas with React Flow Controls & Navigation
const FamilyTreeInner: React.FC = () => {
  const {
    currentFamily,
    availableFamilies,
    activeFamilyId,
    setActiveFamilyId,
    members,
    branches,
    relationships,
    fetchFamilyTree,
    isLiveBackend,
    highlightedPathMemberIds,
    setHighlightedPathMemberIds,
  } = useFamilyStore();
  const { success, error: toastError } = useToastStore();
  const reactFlowInstance = useReactFlow();

  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [drawerMember, setDrawerMember] = useState<FamilyMember | null>(null);
  const activeDrawerMember = drawerMember || selectedMember;
  const [drawerTab, setDrawerTab] = useState<'profile' | 'family' | 'memories' | 'timeline' | 'kinship'>('profile');
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [isCreateFamilyOpen, setIsCreateFamilyOpen] = useState(false);
  const [isFamilyVaultDropdownOpen, setIsFamilyVaultDropdownOpen] = useState(false);
  const [isMemoriesSidebarOpen, setIsMemoriesSidebarOpen] = useState(false);

  const { memories, fetchMemories } = useMemoryStore();
  const { events, fetchTimeline } = useTimelineStore();

  useEffect(() => {
    if (currentFamily?.id) {
      if (memories.length === 0) fetchMemories(currentFamily.id);
      if (events.length === 0) fetchTimeline(currentFamily.id);
    } else {
      fetchFamilyTree();
    }
  }, [currentFamily?.id, fetchFamilyTree]);

  const containerRef = useRef<HTMLDivElement>(null);
  const branchScrollRef = useRef<HTMLDivElement>(null);
  const hasInitialFitted = useRef(false);

  const handleScrollBranches = (direction: 'left' | 'right') => {
    if (branchScrollRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      branchScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Add Relationship Modal state - isolated form handled inside AddMemberModal
  const [isAddRelationshipOpen, setIsAddRelationshipOpen] = useState(false);
  const [relationshipType, setRelationshipType] = useState('CHILD');
  const [targetReferenceMember, setTargetReferenceMember] = useState<FamilyMember | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Member Profile Modal state
  const [editModalMember, setEditModalMember] = useState<FamilyMember | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdatingMember, setIsUpdatingMember] = useState(false);

  // Edit spouse relationship marriage date state
  const [editingSpouseRelId, setEditingSpouseRelId] = useState<string | null>(null);
  const [spouseMarriageDateInput, setSpouseMarriageDateInput] = useState<string>('');
  const [isUpdatingSpouseRel, setIsUpdatingSpouseRel] = useState<boolean>(false);

  const handleSaveSpouseMarriageDate = async (relationshipId: string, newDate: string) => {
    try {
      if (!newDate || !newDate.trim()) {
        toastError('Marriage date (DOM) is compulsory for a spouse.');
        return;
      }
      setIsUpdatingSpouseRel(true);
      const famId = currentFamily?.id || activeFamilyId;
      if (!famId) throw new Error('No active family vault selected');

      const res = await authenticatedFetch(`/api/families/${famId}/relationships/${relationshipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marriageDate: newDate && newDate.trim().length > 0 ? newDate.trim() : null,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || 'Failed to update marriage date');
      }

      await fetchFamilyTree(famId);

      if (activeDrawerMember) {
        const refreshed = useFamilyStore.getState().members.find((m) => m.id === activeDrawerMember.id);
        if (refreshed) {
          if (drawerMember?.id === activeDrawerMember.id) setDrawerMember(refreshed);
          if (selectedMember?.id === activeDrawerMember.id) setSelectedMember(refreshed);
        }
      }

      setEditingSpouseRelId(null);
      setSpouseMarriageDateInput('');
      success(newDate.trim() ? 'Marriage date updated for both spouses' : 'Marriage date removed from both spouses');
    } catch (err: any) {
      console.error('Error updating marriage date:', err);
      toastError(err?.message || 'Failed to update marriage date');
    } finally {
      setIsUpdatingSpouseRel(false);
    }
  };

  const handleOpenEditModal = useCallback((member: FamilyMember) => {
    const fresh =
      members.find((m) => m.id === member.id) ||
      members.find(
        (m) =>
          m.firstName.toLowerCase() === member.firstName.toLowerCase() &&
          m.lastName.toLowerCase() === member.lastName.toLowerCase()
      ) ||
      member;
    setEditModalMember(fresh);
    setIsEditModalOpen(true);
    setShowHint(false);
  }, [members]);

  // Dedicated Member Memory Upload Modal from Family Tree Nodes
  const [memoryUploadMember, setMemoryUploadMember] = useState<FamilyMember | null>(null);
  const [isMemoryUploadModalOpen, setIsMemoryUploadModalOpen] = useState(false);

  const handleOpenUploadMemoryModal = useCallback((member?: FamilyMember | null) => {
    const target = member || selectedMember || members[0] || null;
    if (target && (!target.isLiving || Boolean(target.dateOfDeath))) {
      toastError(`Memories upload is disabled for deceased relative (${target.displayName || `${target.firstName} ${target.lastName}`.trim()}).`);
      return;
    }
    setMemoryUploadMember(target);
    setIsMemoryUploadModalOpen(true);
    setShowHint(false);
  }, [selectedMember, members, toastError]);

  const handleEditMemberSubmit = useCallback(
    async (memberId: string, data: Partial<MemberFormData>) => {
      try {
        setIsUpdatingMember(true);
        const currentMembers = useFamilyStore.getState().members;
        const availableFamilies = useFamilyStore.getState().availableFamilies;
        const currentFam = useFamilyStore.getState().currentFamily;
        const activeFamId = useFamilyStore.getState().activeFamilyId;

        // Resolve member and its true familyId
        const match =
          currentMembers.find((m) => m.id === memberId) ||
          currentMembers.find(
            (m) =>
              m.firstName.toLowerCase() === (data.firstName || editModalMember?.firstName || '').toLowerCase() &&
              m.lastName.toLowerCase() === (data.lastName || editModalMember?.lastName || '').toLowerCase()
          ) ||
          editModalMember;

        let targetMemberId = match?.id || memberId;
        let famId = match?.familyId || currentFam?.id || activeFamId;

        if (!famId && availableFamilies.length > 0) {
          famId = availableFamilies[0].id;
        }
        if (!famId) throw new Error('No active family vault selected');

        const hasDeathDate = Boolean(data.deathDate && data.deathDate.trim());
        const isLiving = hasDeathDate ? false : (data.isLiving ?? true);

        const payload: Record<string, any> = {
          firstName: data.firstName,
          lastName: data.lastName,
          displayName: `${data.firstName} ${data.lastName}`.trim(),
          gender: data.gender,
          isLiving,
          dateOfBirth: data.exactBirthDate || (data.birthYear ? `${data.birthYear}-01-01` : null),
          dateOfDeath: isLiving ? null : (data.deathDate?.trim() || null),
          occupation: data.occupation || undefined,
          birthPlace: data.birthPlace || undefined,
          houseName: data.houseName || undefined,
          location: data.location || undefined,
          profilePhoto: data.photoUrl || undefined,
          biography: data.biography || undefined,
          branchIds: data.branchId ? [data.branchId] : [],
        };

        let res = await authenticatedFetch(`/api/families/${famId}/members/${targetMemberId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        let json = await res.json().catch(() => null);

        // Auto-heal if stale member ID or family ID mismatch: refresh tree and retry once
        if (!res.ok && (res.status === 404 || json?.message?.includes('does not exist in family'))) {
          await fetchFamilyTree();
          const freshMembers = useFamilyStore.getState().members;
          const freshFamily = useFamilyStore.getState().currentFamily;
          const freshFamId = freshFamily?.id || useFamilyStore.getState().activeFamilyId || famId;

          const freshMatch =
            freshMembers.find((m) => m.id === targetMemberId) ||
            freshMembers.find(
              (m) =>
                m.firstName.toLowerCase() === (data.firstName || editModalMember?.firstName || '').toLowerCase() &&
                m.lastName.toLowerCase() === (data.lastName || editModalMember?.lastName || '').toLowerCase()
            );

          if (freshMatch) {
            targetMemberId = freshMatch.id;
            const retryFamId = freshMatch.familyId || freshFamId;
            res = await authenticatedFetch(`/api/families/${retryFamId}/members/${targetMemberId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            json = await res.json().catch(() => null);
          }
        }

        if (!res.ok || !json?.success) {
          throw new Error(json?.message || json?.error?.message || 'Failed to update member profile');
        }

        // If marriage date was edited/cleared, update the spouse relationship
        if (data.marriageDate !== undefined) {
          const spouseRel = relationships.find(
            (r) =>
              r.relationshipType === 'SPOUSE' &&
              (r.sourceMemberId === memberId || r.targetMemberId === memberId)
          );
          if (spouseRel) {
            await authenticatedFetch(`/api/families/${famId}/relationships/${spouseRel.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                marriageDate: data.marriageDate && data.marriageDate.trim().length > 0 ? data.marriageDate.trim() : null,
              }),
            });
          }
        }

        await fetchFamilyTree(famId);

        const refreshedMembers = useFamilyStore.getState().members;
        const refreshedMember = refreshedMembers.find((m) => m.id === memberId);
        if (refreshedMember) {
          if (selectedMember?.id === memberId) {
            setSelectedMember(refreshedMember);
          }
          if (drawerMember?.id === memberId) {
            setDrawerMember(refreshedMember);
          }
        }

        setIsEditModalOpen(false);
        setEditModalMember(null);
        success('Member profile updated successfully');
      } catch (err: any) {
        console.error('Error updating member profile:', err);
        toastError(err?.message || 'Failed to update member profile');
        throw err;
      } finally {
        setIsUpdatingMember(false);
      }
    },
    [currentFamily?.id, activeFamilyId, fetchFamilyTree, selectedMember?.id, drawerMember?.id, relationships, success, toastError]
  );

  // Edit Life Status Modal state
  const [lifeStatusModalMember, setLifeStatusModalMember] = useState<FamilyMember | null>(null);
  const [isLifeStatusModalOpen, setIsLifeStatusModalOpen] = useState(false);
  const [isUpdatingLifeStatus, setIsUpdatingLifeStatus] = useState(false);

  // Phase 41: Full-Size Profile Photo Lightbox Modal state
  const [photoViewerState, setPhotoViewerState] = useState<{
    member: FamilyMember;
    photoUrl: string;
  } | null>(null);

  const handleOpenLifeStatusModal = useCallback((member: FamilyMember) => {
    setLifeStatusModalMember(member);
    setIsLifeStatusModalOpen(true);
    setShowHint(false);
  }, []);

  const handleSaveLifeStatus = useCallback(
    async (memberId: string, isLiving: boolean, deathDate: string | null) => {
      try {
        setIsUpdatingLifeStatus(true);
        const famId = currentFamily?.id || activeFamilyId;
        if (!famId) throw new Error('No active family vault selected');

        const payload: Record<string, any> = {
          isLiving,
          dateOfDeath: isLiving ? null : (deathDate && deathDate.trim().length > 0 ? deathDate.trim() : null),
        };

        const res = await authenticatedFetch(`/api/families/${famId}/members/${memberId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || json?.error?.message || 'Failed to update life status');
        }

        await fetchFamilyTree(famId);

        const refreshedMembers = useFamilyStore.getState().members;
        const refreshedMember = refreshedMembers.find((m) => m.id === memberId);
        if (refreshedMember) {
          if (selectedMember?.id === memberId) {
            setSelectedMember(refreshedMember);
          }
          if (drawerMember?.id === memberId) {
            setDrawerMember(refreshedMember);
          }
        }

        setIsLifeStatusModalOpen(false);
        setLifeStatusModalMember(null);
        success(
          `Updated status to ${isLiving ? 'Living' : 'Rest in Peace'}`,
          'Status Updated'
        );
      } catch (err: any) {
        console.error('Error updating life status:', err);
        toastError(err?.message || 'Failed to update life status');
        throw err;
      } finally {
        setIsUpdatingLifeStatus(false);
      }
    },
    [currentFamily?.id, activeFamilyId, fetchFamilyTree, selectedMember?.id, drawerMember?.id, success, toastError]
  );

  const handleToggleLiving = useCallback(
    async (member: FamilyMember) => {
      handleOpenLifeStatusModal(member);
    },
    [handleOpenLifeStatusModal]
  );

  // Kinship path finder state
  const [kinshipTargetId, setKinshipTargetId] = useState<string>('');
  const [kinshipResult, setKinshipResult] = useState<{
    relationship: string;
    distance: number;
    path: Array<{ fromName: string; toName: string; step: string }>;
  } | null>(null);
  const [isCalculatingKinship, setIsCalculatingKinship] = useState(false);

  // Business rule (Phase 33): Check if a member has a valid registered spouse
  const memberHasSpouse = useCallback(
    (memberId: string) => {
      return relationships.some(
        (r) =>
          r.relationshipType === 'SPOUSE' &&
          r.status !== 'HISTORICAL' &&
          (r.sourceMemberId === memberId || r.targetMemberId === memberId)
      );
    },
    [relationships]
  );

  // Trigger add relative for a specific member
  const handleOpenAddRelative = useCallback(
    (member: FamilyMember, defaultType: 'CHILD' | 'SPOUSE' | 'PARENT') => {
      if (defaultType === 'CHILD' && !memberHasSpouse(member.id)) {
        toastError('Add a spouse before adding a child.', 'Spouse Required');
        return;
      }
      setTargetReferenceMember(member);
      setRelationshipType(defaultType);
      setIsAddRelationshipOpen(true);
      setShowHint(false);
    },
    [memberHasSpouse, toastError]
  );

  // Photo URL Editing state
  const [editingPhotoMemberId, setEditingPhotoMemberId] = useState<string | null>(null);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);

  const handleSavePhotoUrl = async (memberId: string, url: string) => {
    try {
      setIsSavingPhoto(true);
      const famId = currentFamily?.id || activeFamilyId;
      if (!famId) return;
      const cleanUrl = url.trim();

      const res = await authenticatedFetch(`/api/families/${famId}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify({ profilePhoto: cleanUrl || null }),
      });

      if (res.ok) {
        await fetchFamilyTree(famId);
        if (selectedMember?.id === memberId) {
          setSelectedMember((prev) =>
            prev
              ? { ...prev, profilePhoto: cleanUrl || undefined, avatar: cleanUrl || undefined }
              : null
          );
        }
        if (drawerMember?.id === memberId) {
          setDrawerMember((prev) =>
            prev
              ? { ...prev, profilePhoto: cleanUrl || undefined, avatar: cleanUrl || undefined }
              : null
          );
        }
        setEditingPhotoMemberId(null);
      }
    } catch (err) {
      console.error('Failed to update member photo URL', err);
    } finally {
      setIsSavingPhoto(false);
    }
  };

  // Immediate relatives for active drawer member
  const immediateRelatives = useMemo(() => {
    if (!activeDrawerMember) return { parents: [] as FamilyMember[], children: [] as FamilyMember[], spouses: [] as FamilyMember[], siblings: [] as FamilyMember[] };
    const parents: FamilyMember[] = [];
    const children: FamilyMember[] = [];
    const spouses: FamilyMember[] = [];
    const siblings: FamilyMember[] = [];

    const memberMap = new Map(members.map((m) => [m.id, m]));

    relationships.forEach((rel) => {
      if (
        rel.relationshipType === 'PARENT' ||
        rel.relationshipType === 'ADOPTIVE_PARENT' ||
        rel.relationshipType === 'STEP_PARENT'
      ) {
        if (rel.sourceMemberId === activeDrawerMember.id) {
          const child = memberMap.get(rel.targetMemberId);
          if (child && !children.some((c) => c.id === child.id)) children.push(child);
        }
        if (rel.targetMemberId === activeDrawerMember.id) {
          const parent = memberMap.get(rel.sourceMemberId);
          if (parent && !parents.some((p) => p.id === parent.id)) parents.push(parent);
        }
      } else if (
        rel.relationshipType === 'CHILD' ||
        rel.relationshipType === 'ADOPTED_CHILD' ||
        rel.relationshipType === 'STEP_CHILD'
      ) {
        if (rel.sourceMemberId === activeDrawerMember.id) {
          const parent = memberMap.get(rel.targetMemberId);
          if (parent && !parents.some((p) => p.id === parent.id)) parents.push(parent);
        }
        if (rel.targetMemberId === activeDrawerMember.id) {
          const child = memberMap.get(rel.sourceMemberId);
          if (child && !children.some((c) => c.id === child.id)) children.push(child);
        }
      } else if (rel.relationshipType === 'SPOUSE') {
        if (rel.sourceMemberId === activeDrawerMember.id) {
          const spouse = memberMap.get(rel.targetMemberId);
          if (spouse && !spouses.some((s) => s.id === spouse.id)) spouses.push(spouse);
        }
        if (rel.targetMemberId === activeDrawerMember.id) {
          const spouse = memberMap.get(rel.sourceMemberId);
          if (spouse && !spouses.some((s) => s.id === spouse.id)) spouses.push(spouse);
        }
      }
    });

    // Siblings (share at least one parent)
    parents.forEach((p) => {
      relationships.forEach((rel) => {
        if (
          (rel.relationshipType === 'PARENT' ||
            rel.relationshipType === 'ADOPTIVE_PARENT' ||
            rel.relationshipType === 'STEP_PARENT') &&
          rel.sourceMemberId === p.id &&
          rel.targetMemberId !== activeDrawerMember.id
        ) {
          const sib = memberMap.get(rel.targetMemberId);
          if (sib && !siblings.some((s) => s.id === sib.id)) siblings.push(sib);
        }
      });
    });

    return { parents, children, spouses, siblings };
  }, [activeDrawerMember, relationships, members]);

  // Date rows for active drawer member using strict rules
  const drawerSpouseRel = useMemo(() => {
    if (!activeDrawerMember) return null;
    return relationships.find(
      (r) =>
        r.relationshipType === 'SPOUSE' &&
        (r.sourceMemberId === activeDrawerMember.id || r.targetMemberId === activeDrawerMember.id) &&
        (r.marriageDate || (r.metadata as any)?.marriageDate)
    );
  }, [activeDrawerMember, relationships]);

  const drawerMarriageDate =
    (activeDrawerMember as any)?.dateOfMarriage ||
    (activeDrawerMember as any)?.marriageDate ||
    drawerSpouseRel?.marriageDate ||
    (drawerSpouseRel?.metadata as any)?.marriageDate ||
    null;

  const drawerDateRows = useMemo(() => {
    if (!activeDrawerMember) return [];
    const isDeceased = !activeDrawerMember.isLiving || Boolean(activeDrawerMember.dateOfDeath);
    const formattedDob = formatSingleDate(activeDrawerMember.dateOfBirth);
    const formattedDom = formatSingleDate(drawerMarriageDate);
    const formattedDod = formatSingleDate(activeDrawerMember.dateOfDeath);

    const rows: { label: 'DOB' | 'DOM' | 'DOD'; text: string }[] = [];
    if (formattedDob) rows.push({ label: 'DOB', text: `DOB: ${formattedDob}` });
    if (formattedDom) rows.push({ label: 'DOM', text: `DOM: ${formattedDom}` });
    if (isDeceased && formattedDod) rows.push({ label: 'DOD', text: `DOD: ${formattedDod}` });
    return rows;
  }, [activeDrawerMember, drawerMarriageDate]);

  // Compute immediate relatives for hover highlighting
  const hoveredRelatedIds = useMemo(() => {
    if (!hoveredMemberId) return new Set<string>();
    const related = new Set<string>([hoveredMemberId]);

    relationships.forEach((rel) => {
      if (rel.sourceMemberId === hoveredMemberId) {
        related.add(rel.targetMemberId);
      }
      if (rel.targetMemberId === hoveredMemberId) {
        related.add(rel.sourceMemberId);
      }
    });

    return related;
  }, [hoveredMemberId, relationships]);

  // Determine connected ancestor & descendant node IDs when Focus Mode is ON
  const focusedNodeIds = useMemo(() => {
    if (!isFocusMode || !selectedMember) return null;
    const connected = new Set<string>([selectedMember.id]);

    relationships.forEach((rel) => {
      if (rel.sourceMemberId === selectedMember.id) {
        connected.add(rel.targetMemberId);
      }
      if (rel.targetMemberId === selectedMember.id) {
        connected.add(rel.sourceMemberId);
      }
    });

    return connected;
  }, [isFocusMode, selectedMember, relationships]);

  // Deterministic tree layout computation
  const layoutResult = useMemo(() => {
    return calculateTreeLayout(members, relationships, {
      selectedBranch,
      searchQuery,
      selectedMemberId: selectedMember?.id,
      focusedNodeIds,
      hoveredMemberId,
      hoveredRelatedIds,
      highlightedPathMemberIds,
    });
  }, [
    members,
    relationships,
    selectedBranch,
    searchQuery,
    selectedMember?.id,
    focusedNodeIds,
    hoveredMemberId,
    hoveredRelatedIds,
    highlightedPathMemberIds,
  ]);

  // Attach interactive handlers to member node data
  const finalNodes = useMemo(() => {
    return layoutResult.nodes.map((node) => {
      if (node.type === 'starterNode') {
        const isCurrentStarterLoading =
          isSubmitting &&
          ((members.length === 0 && node.data?.starterType === 'member') ||
            (members.length === 1 && node.data?.starterType === 'spouse'));

        return {
          ...node,
          data: {
            ...node.data,
            isLoading: isCurrentStarterLoading,
            onAddStarterMember: () => {
              setTargetReferenceMember(null);
              setRelationshipType('CHILD');
              setIsAddRelationshipOpen(true);
              setShowHint(false);
            },
            onAddStarterSpouse: (partnerId?: string) => {
              if (members.length === 0) {
                // If 0 members, prompt creation for the primary member first
                setTargetReferenceMember(null);
                setRelationshipType('CHILD');
                setIsAddRelationshipOpen(true);
                setShowHint(false);
              } else {
                const partner = members.find((m) => m.id === partnerId) || members[0];
                handleOpenAddRelative(partner, 'SPOUSE');
              }
            },
          },
        };
      }
      if (node.type !== 'heritageMember') return node;
      const hasSpouse = node.data.hasSpouse !== undefined ? node.data.hasSpouse : memberHasSpouse(node.data.member.id);
      const isSecondarySpouse = node.data.isSecondarySpouse ?? false;
      const isPrimaryPartner = node.data.isPrimaryPartner ?? !isSecondarySpouse;
      const hideRelationshipActions = node.data.hideRelationshipActions ?? isSecondarySpouse;
      const effectiveMarriageDate = isSecondarySpouse ? null : node.data.marriageDate;
      return {
        ...node,
        data: {
          ...node.data,
          member: isSecondarySpouse
            ? { ...node.data.member, dateOfMarriage: null, marriageDate: null }
            : {
                ...node.data.member,
                ...(effectiveMarriageDate
                  ? { dateOfMarriage: effectiveMarriageDate, marriageDate: effectiveMarriageDate }
                  : {}),
              },
          hasSpouse,
          isPrimaryPartner,
          isSecondarySpouse,
          hideRelationshipActions,
          marriageDate: effectiveMarriageDate,
          onSelect: (_sel: FamilyMember) => {
            // Node/card click -> NO profile opening and NO automatic selection (Requirements 1, 2, 9)
          },
          onHover: (id: string | null) => {
            setHoveredMemberId(id);
          },
          onAddRelative: (m: FamilyMember, rel: 'CHILD' | 'SPOUSE' | 'PARENT') => {
            handleOpenAddRelative(m, rel);
          },
          onOpenProfile: (m: FamilyMember) => {
            // Profile opening ONLY via eye icon (Requirements 1, 2, 9)
            setIsMemoriesSidebarOpen(false);
            setDrawerMember(m);
            setDrawerTab('profile');
            setShowHint(false);
          },
          onExploreKinship: (m: FamilyMember) => {
            setIsMemoriesSidebarOpen(false);
            setDrawerMember(m);
            setDrawerTab('kinship');
            setShowHint(false);
          },
          onEditProfile: (m: FamilyMember) => {
            handleOpenEditModal(m);
          },
          onToggleLiving: (m: FamilyMember) => {
            handleToggleLiving(m);
          },
          onEditLifeStatus: (m: FamilyMember) => {
            handleOpenLifeStatusModal(m);
          },
          onViewPhoto: (m: FamilyMember, photoUrl: string) => {
            setPhotoViewerState({ member: m, photoUrl });
          },
          onUploadMemory: (m: FamilyMember) => {
            handleOpenUploadMemoryModal(m);
          },
        },
      };
    });
  }, [layoutResult.nodes, handleOpenAddRelative, handleOpenEditModal, handleToggleLiving, handleOpenLifeStatusModal, handleOpenUploadMemoryModal, members, isSubmitting, memberHasSpouse]);

  const [nodes, setNodes, onNodesChange] = useNodesState(finalNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutResult.edges);

  useEffect(() => {
    setNodes(finalNodes);
  }, [finalNodes, setNodes]);

  useEffect(() => {
    setEdges(layoutResult.edges);
  }, [layoutResult.edges, setEdges]);

  // Exact viewport centering helper with dynamic fit-to-family scaling
  const centerTreeCanvas = useCallback(
    (smooth = true) => {
      if (!containerRef.current || !reactFlowInstance) return;
      const containerWidth = containerRef.current.clientWidth || 1000;
      const containerHeight = containerRef.current.clientHeight || 700;

      // Filter to real family member nodes & starter nodes (ignoring floating markers)
      const familyNodes = nodes.filter(
        (n) => n.type === 'heritageMember' || n.type === 'starterNode'
      );

      if (familyNodes.length === 0) {
        if (layoutResult.nodes.length > 0) {
          try {
            reactFlowInstance.fitView({ padding: 0.12, duration: smooth ? 450 : 0, minZoom: 0.15, maxZoom: 1.15 });
          } catch {}
        }
        return;
      }

      // Compute exact bounding box of actual family cards
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      familyNodes.forEach((n) => {
        if (n.position.x < minX) minX = n.position.x;
        if (n.position.x + 280 > maxX) maxX = n.position.x + 280;
        if (n.position.y < minY) minY = n.position.y;
        if (n.position.y + 160 > maxY) maxY = n.position.y + 160;
      });

      const familyWidth = maxX - minX;
      const familyHeight = maxY - minY;
      const centerX = minX + familyWidth / 2;
      const centerY = minY + familyHeight / 2;

      // Ensure generous padding so outer cards, generation badges, and connectors remain fully visible
      const paddingX = Math.max(48, containerWidth * 0.08);
      const paddingY = Math.max(48, containerHeight * 0.08);

      // Fit bounds to show the entire family tree structure
      try {
        reactFlowInstance.fitBounds(
          {
            x: minX - paddingX,
            y: minY - paddingY,
            width: familyWidth + paddingX * 2,
            height: familyHeight + paddingY * 2,
          },
          { duration: smooth ? 500 : 0 }
        );
      } catch {
        const availableWidth = Math.max(100, containerWidth - paddingX * 2);
        const availableHeight = Math.max(100, containerHeight - paddingY * 2);
        const targetZoom = Math.min(
          1.15,
          Math.max(
            0.15,
            Math.min(
              availableWidth / Math.max(familyWidth, 280),
              availableHeight / Math.max(familyHeight, 160)
            )
          )
        );
        reactFlowInstance.setCenter(centerX, centerY, {
          zoom: targetZoom,
          duration: smooth ? 500 : 0,
        });
      }
    },
    [nodes, layoutResult.nodes.length, reactFlowInstance]
  );

  // Re-center when container dimensions change (resize, fullscreen, sidebar toggle)
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (members.length <= 2) {
        centerTreeCanvas(false);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [members.length, centerTreeCanvas]);

  // Initial and reactive centering on family change or member count update
  const lastVaultId = useRef<string | null>(null);
  const prevMemberCount = useRef(members.length);
  useEffect(() => {
    if (layoutResult.nodes.length > 0) {
      const isNewFamily = currentFamily?.id && currentFamily.id !== lastVaultId.current;
      const isCountChange = members.length !== prevMemberCount.current;
      if (isNewFamily || isCountChange || !hasInitialFitted.current) {
        const timer = setTimeout(() => {
          centerTreeCanvas(true);
          hasInitialFitted.current = true;
          if (currentFamily?.id) lastVaultId.current = currentFamily.id;
          prevMemberCount.current = members.length;
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [layoutResult.nodes.length, currentFamily?.id, members.length, centerTreeCanvas]);

  // When Focus Mode is toggled or member selected in focus mode: smooth pan & zoom
  useEffect(() => {
    if (isFocusMode && selectedMember) {
      const selectedNode = nodes.find((n) => n.id === selectedMember.id);
      if (selectedNode) {
        if (focusedNodeIds && focusedNodeIds.size > 0) {
          const focusedNodes = nodes.filter((n) => focusedNodeIds.has(n.id));
          if (focusedNodes.length > 0) {
            const minX = Math.min(...focusedNodes.map((n) => n.position.x));
            const maxX = Math.max(...focusedNodes.map((n) => n.position.x + 280));
            const minY = Math.min(...focusedNodes.map((n) => n.position.y));
            const maxY = Math.max(...focusedNodes.map((n) => n.position.y + 160));

            reactFlowInstance.fitBounds(
              {
                x: minX - 80,
                y: minY - 80,
                width: maxX - minX + 160,
                height: maxY - minY + 160,
              },
              { duration: 650 }
            );
            return;
          }
        }
        reactFlowInstance.setCenter(
          selectedNode.position.x + 140,
          selectedNode.position.y + 80,
          { zoom: 1.15, duration: 650 }
        );
      }
    }
  }, [isFocusMode, selectedMember, focusedNodeIds, nodes, reactFlowInstance]);

  // Jump to searched member on canvas (Requirement 10)
  const handleJumpToMember = (memberId: string) => {
    const targetNode = nodes.find((n) => n.id === memberId);
    if (targetNode) {
      reactFlowInstance.setCenter(
        targetNode.position.x + 140,
        targetNode.position.y + 80,
        {
          zoom: 1.15,
          duration: 650,
        }
      );
      const targetMember = members.find((m) => m.id === memberId);
      if (targetMember) {
        setSelectedMember(targetMember);
        setShowHint(false);
      }
    }
    setIsSearchDropdownOpen(false);
  };

  const isFullscreenRef = useRef(false);
  isFullscreenRef.current = isFullscreen;

  // Track if fullscreen was active
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__familyRootsWasFullscreen = isFullscreen;
    }
  }, [isFullscreen]);

  // Cleanup body scroll on unmount
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, []);

  // Restore fullscreen helper
  const restoreFullscreen = useCallback(() => {
    setIsFullscreen(true);
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }, []);

  // Toggle Fullscreen / Application-level Immersive Mode
  const toggleFullscreen = useCallback(() => {
    if (!isFullscreenRef.current) {
      setIsFullscreen(true);
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
      }
      // Optional browser fullscreen as progressive enhancement, does not gate immersive mode
      try {
        if (containerRef.current && typeof document !== 'undefined' && !document.fullscreenElement) {
          containerRef.current.requestFullscreen?.().catch(() => {});
        }
      } catch {}
      setTimeout(() => {
        try {
          reactFlowInstance?.fitView({ padding: 0.2, duration: 400 });
        } catch {}
      }, 100);
    } else {
      setIsFullscreen(false);
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
        if (document.fullscreenElement) {
          try {
            document.exitFullscreen?.().catch(() => {});
          } catch {}
        }
      }
      setTimeout(() => {
        try {
          reactFlowInstance?.fitView({ padding: 0.15, duration: 300 });
        } catch {}
      }, 100);
    }
  }, [reactFlowInstance]);

  // Handle Escape key to exit immersive mode when no dialog/modal is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreenRef.current) {
        const isAnyModalOpen =
          isEditModalOpen ||
          isAddRelationshipOpen ||
          isLifeStatusModalOpen ||
          Boolean(photoViewerState);
        if (!isAnyModalOpen) {
          toggleFullscreen();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditModalOpen, isAddRelationshipOpen, isLifeStatusModalOpen, photoViewerState, toggleFullscreen]);

  // Synchronize fullscreen state on browser fullscreenchange events
  // Preserves immersive mode across OS file picker dialogs
  useEffect(() => {
    const handleFullscreenChange = () => {
      // If browser native fullscreen was activated externally, sync to immersive mode
      if (document.fullscreenElement) {
        setIsFullscreen(true);
        document.body.style.overflow = 'hidden';
      }
      // Note: If document.fullscreenElement drops to null (e.g. OS file picker opening),
      // we DO NOT drop application immersive mode. Immersive mode ends strictly when
      // user explicitly clicks Exit Fullscreen or presses Esc with no modal open.
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Reset view to fit all family members and show full tree structure
  const handleFitFamily = () => {
    if (isFocusMode) {
      setIsFocusMode(false);
      setSelectedMember(null);
    }
    centerTreeCanvas(true);
  };

  // Clear focus and highlight
  const handleClearFocus = () => {
    setIsFocusMode(false);
    setSelectedMember(null);
    setDrawerMember(null);
    setSearchQuery('');
    setHoveredMemberId(null);
    setKinshipResult(null);
    handleFitFamily();
  };

  // Kinship Path Engine
  const handleCalculateKinship = async () => {
    if (!activeDrawerMember || !kinshipTargetId || !currentFamily.id) return;
    setIsCalculatingKinship(true);
    setKinshipResult(null);
    try {
      const res = await fetch(
        `/api/families/${currentFamily.id}/kinship/${activeDrawerMember.id}/${kinshipTargetId}`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setKinshipResult(json.data);
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsCalculatingKinship(false);
    }
  };

  // Search Results Dropdown
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return members
      .filter((m) => {
        const name = `${m.firstName} ${m.lastName} ${m.displayName || ''}`.toLowerCase();
        return name.includes(q);
      })
      .slice(0, 6);
  }, [searchQuery, members]);

  // Handle Add Relationship Form Submission
  const handleAddRelationshipSubmit = async (formData: MemberFormData) => {
    if (isSubmitting) return;
    const isRoot = members.length === 0 || (!targetReferenceMember && !selectedMember);
    const refMember = targetReferenceMember || selectedMember;

    if (!isRoot && !refMember) {
      toastError('Please select a reference member first.', 'Missing Reference');
      throw new Error('Please select a reference member first.');
    }

    const relType = formData.relationshipType || relationshipType;
    if (
      (relType === 'CHILD' || relType === 'ADOPTED_CHILD' || relType === 'STEP_CHILD') &&
      refMember &&
      !memberHasSpouse(refMember.id)
    ) {
      toastError(`Add a spouse to ${refMember.firstName} before adding a child.`, 'Spouse Required');
      throw new Error('Add a spouse before adding a child.');
    }

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toastError('First and Last names are required.', 'Missing Fields');
      throw new Error('First and Last names are required.');
    }
    setIsSubmitting(true);

    try {
      // 1. Resolve active family ID reliably across store, state, localStorage, and backend
      let famId = currentFamily?.id || activeFamilyId || useFamilyStore.getState().activeFamilyId || useFamilyStore.getState().currentFamily?.id;
      if (!famId) {
        try {
          const stored = localStorage.getItem('familyroots_active_family_id');
          if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim().length > 0) {
            famId = stored.trim();
          }
        } catch {}
      }

      // Check available families in store or fetch from backend
      let available = useFamilyStore.getState().availableFamilies;
      if (!available || available.length === 0) {
        available = await useFamilyStore.getState().fetchAvailableFamilies();
      }

      // If famId is a display name or invalid hex, resolve against available families
      if (available && available.length > 0) {
        if (famId) {
          const matched = available.find(
            (f) => f.id === famId || f.name.toLowerCase() === famId!.toLowerCase()
          );
          if (matched) {
            famId = matched.id;
          } else {
            famId = available[0].id;
          }
        } else {
          famId = available[0].id;
        }
        await setActiveFamilyId(famId);
      }

      if (!famId) {
        throw new Error(
          'Unable to add member because the active family could not be resolved. Please select your family again.'
        );
      }

      const birthDate =
        formData.exactBirthDate ||
        (formData.birthYear ? `${formData.birthYear}-01-01` : undefined);

      const hasDeathDate = Boolean(formData.deathDate && formData.deathDate.trim());
      const effectiveLiving = hasDeathDate ? false : formData.isLiving;
      const effectiveDeathDate = effectiveLiving ? undefined : (formData.deathDate?.trim() || undefined);

      if (isRoot) {
        // Create root ancestor (Generation 1, no parent or spouse relationship required)
        const rootPayload = {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          gender: formData.gender,
          dateOfBirth: birthDate,
          dateOfDeath: effectiveDeathDate,
          isLiving: effectiveLiving,
          occupation: formData.occupation || undefined,
          birthPlace: formData.birthPlace || undefined,
          houseName: formData.houseName || undefined,
          location: formData.location || undefined,
          profilePhoto: formData.photoUrl || undefined,
          generation: 1,
          branchIds: formData.branchId ? [formData.branchId] : [],
          biography: formData.biography
            ? formData.notes
              ? `${formData.biography}\n\nNotes: ${formData.notes}`
              : formData.biography
            : formData.notes || undefined,
        };

        const memberRes = await authenticatedFetch(`/api/families/${famId}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rootPayload),
        });

        const memberJson = await memberRes.json().catch(() => null);
        if (!memberRes.ok || !memberJson?.success) {
          throw new Error(memberJson?.message || 'Failed to create root ancestor record');
        }

        const newMemberId = memberJson.data?._id || memberJson.data?.id;
        if (!newMemberId) {
          throw new Error('New member ID was not returned by the server');
        }

        // Invalidate and refresh family tree from database
        await fetchFamilyTree(famId);

        // Select the newly created member in the store
        const updatedMembers = useFamilyStore.getState().members;
        const createdMember =
          updatedMembers.find((m) => m.id === newMemberId) || updatedMembers[0];
        if (createdMember) {
          setSelectedMember(createdMember);
          setDrawerTab('profile');
        }

        // Smoothly center the canvas onto the new member / couple
        setTimeout(() => {
          centerTreeCanvas(true);
        }, 200);

        success(
          `Added ${formData.firstName} ${formData.lastName} as Root Ancestor. Family tree initialized!`,
          'Tree Synchronized'
        );

        setIsAddRelationshipOpen(false);
        setIsSubmitting(false);
        return;
      }

      // Calculate generation
      let calculatedGen = refMember!.generation || 1;
      const relType = formData.relationshipType;
      if (
        relType === 'CHILD' ||
        relType === 'ADOPTED_CHILD' ||
        relType === 'STEP_CHILD'
      ) {
        calculatedGen = (refMember!.generation || 1) + 1;
      } else if (
        relType === 'PARENT' ||
        relType === 'ADOPTIVE_PARENT' ||
        relType === 'STEP_PARENT'
      ) {
        calculatedGen = Math.max(1, (refMember!.generation || 1) - 1);
      } else if (relType === 'SPOUSE') {
        calculatedGen = refMember!.generation || 1;
      }

      const memberPayload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        gender: formData.gender,
        dateOfBirth: birthDate,
        dateOfDeath: effectiveDeathDate,
        isLiving: effectiveLiving,
        occupation: formData.occupation || undefined,
        birthPlace: formData.birthPlace || undefined,
        houseName: formData.houseName || undefined,
        location: formData.location || undefined,
        profilePhoto: formData.photoUrl || undefined,
        generation: calculatedGen,
        branchIds: formData.branchId
          ? [formData.branchId]
          : refMember!.branchId
          ? [refMember!.branchId]
          : [],
        biography: formData.biography
          ? formData.notes
            ? `${formData.biography}\n\nNotes: ${formData.notes}`
            : formData.biography
          : formData.notes || undefined,
      };

      const memberRes = await authenticatedFetch(`/api/families/${famId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberPayload),
      });

      const memberJson = await memberRes.json().catch(() => null);
      if (!memberRes.ok || !memberJson?.success) {
        throw new Error(memberJson?.message || 'Failed to create family member record');
      }

      const newMemberId = memberJson.data?._id || memberJson.data?.id;
      if (!newMemberId) {
        throw new Error('New member ID was not returned by the server');
      }

      // Determine correct relationship source, target and type
      let srcId = refMember!.id;
      let tgtId = newMemberId;
      let rType: string = relType;

      if (relType === 'CHILD') {
        srcId = refMember!.id;
        tgtId = newMemberId;
        rType = 'PARENT';
      } else if (relType === 'ADOPTED_CHILD') {
        srcId = refMember!.id;
        tgtId = newMemberId;
        rType = 'ADOPTIVE_PARENT';
      } else if (relType === 'STEP_CHILD') {
        srcId = refMember!.id;
        tgtId = newMemberId;
        rType = 'STEP_PARENT';
      } else if (relType === 'SPOUSE') {
        srcId = refMember!.id;
        tgtId = newMemberId;
        rType = 'SPOUSE';
      } else if (relType === 'PARENT') {
        srcId = newMemberId;
        tgtId = refMember!.id;
        rType = 'PARENT';
      } else if (relType === 'ADOPTIVE_PARENT') {
        srcId = newMemberId;
        tgtId = refMember!.id;
        rType = 'ADOPTIVE_PARENT';
      } else if (relType === 'STEP_PARENT') {
        srcId = newMemberId;
        tgtId = refMember!.id;
        rType = 'STEP_PARENT';
      }

      const isAddingChild = rType === 'PARENT' && srcId === refMember!.id;
      let nextChildOrder: number | undefined = undefined;
      if (isAddingChild) {
        const parentSpouseRel = relationships.find(
          (r) =>
            r.relationshipType === 'SPOUSE' &&
            (r.sourceMemberId === refMember!.id || r.targetMemberId === refMember!.id)
        );
        const parentIds = new Set<string>([refMember!.id]);
        if (parentSpouseRel) {
          parentIds.add(parentSpouseRel.sourceMemberId);
          parentIds.add(parentSpouseRel.targetMemberId);
        }

        let maxChildOrder = 0;
        relationships.forEach((r) => {
          if (
            (r.relationshipType === 'PARENT' ||
              r.relationshipType === 'ADOPTIVE_PARENT' ||
              r.relationshipType === 'STEP_PARENT') &&
            parentIds.has(r.sourceMemberId)
          ) {
            const ord = r.siblingOrder ?? r.displayOrder ?? 0;
            if (ord > maxChildOrder) maxChildOrder = ord;
          }
        });
        nextChildOrder = maxChildOrder + 1;
      }

      const relPayload: {
        sourceMemberId: string;
        targetMemberId: string;
        relationshipType: string;
        marriageDate?: string;
        siblingOrder?: number;
        displayOrder?: number;
      } = {
        sourceMemberId: srcId,
        targetMemberId: tgtId,
        relationshipType: rType,
      };

      if (nextChildOrder !== undefined) {
        relPayload.siblingOrder = nextChildOrder;
        relPayload.displayOrder = nextChildOrder;
      }

      if (rType === 'SPOUSE') {
        if (!formData.marriageDate || !formData.marriageDate.trim()) {
          throw new Error('Marriage date (DOM) is compulsory when adding a spouse.');
        }
        relPayload.marriageDate = formData.marriageDate.trim();
      }

      const relRes = await authenticatedFetch(`/api/families/${famId}/relationships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(relPayload),
      });

      const relJson = await relRes.json().catch(() => null);
      if (!relRes.ok || !relJson?.success) {
        throw new Error(relJson?.message || 'Failed to establish relationship in graph');
      }

      // Refresh the family tree directly from the database
      await fetchFamilyTree(famId);

      // Open profile drawer for the newly created member without selecting node on canvas
      const updatedMembers = useFamilyStore.getState().members;
      const createdMember = updatedMembers.find((m) => m.id === newMemberId);
      if (createdMember) {
        setDrawerMember(createdMember);
        setDrawerTab('profile');
      }

      // Smoothly pan and center the canvas onto the newly created node/couple
      setTimeout(() => {
        centerTreeCanvas(true);
      }, 250);

      success(
        `Added ${formData.firstName} ${formData.lastName} as ${relType.toLowerCase()} to ${refMember!.firstName}. Tree updated.`,
        'Tree Synchronized'
      );

      setIsAddRelationshipOpen(false);
      setIsSubmitting(false);
    } catch (err: any) {
      setIsSubmitting(false);
      toastError(err?.message || 'Failed to record new member.', 'Error');
      throw err;
    }
  };

  const editModalSpouseMarriageDate = useMemo(() => {
    if (!editModalMember) return null;
    const spouseRel = relationships.find(
      (r) =>
        r.relationshipType === 'SPOUSE' &&
        (r.sourceMemberId === editModalMember.id || r.targetMemberId === editModalMember.id) &&
        (r.marriageDate || (r.metadata as any)?.marriageDate)
    );
    return (
      (editModalMember as any)?.dateOfMarriage ||
      (editModalMember as any)?.marriageDate ||
      spouseRel?.marriageDate ||
      (spouseRel?.metadata as any)?.marriageDate ||
      null
    );
  }, [editModalMember, relationships]);

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] relative">
      {/* Top Header & Canvas Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div>
          <div className="flex items-center gap-2.5 relative">
            <div className="flex items-center gap-1.5">
              <h2 className="text-2xl sm:text-[28px] font-bold text-[#17233C] tracking-tight" data-testid="family-heading-name">
                {formatFamilyDisplayName(currentFamily?.name)}
              </h2>
              {availableFamilies.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIsFamilyVaultDropdownOpen((prev) => !prev)}
                  className="p-1 rounded-lg text-slate-500 hover:text-[#2563EB] hover:bg-blue-50 transition-colors cursor-pointer"
                  title="Switch family vault"
                  aria-label="Switch family vault"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              )}
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EFF6FF] text-[#2563EB] border-[1.5px] border-[#93C5FD]">
              {members.length} {members.length === 1 ? 'Relative' : 'Relatives'}
            </span>

            {isFamilyVaultDropdownOpen && availableFamilies.length > 1 && (
              <div className="absolute left-0 top-full mt-1.5 w-60 rounded-xl bg-white border border-[#E2E8F0] shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400">
                  Switch Family Vault
                </div>
                {availableFamilies.map((fam) => (
                  <button
                    key={fam.id}
                    type="button"
                    onClick={() => {
                      setActiveFamilyId(fam.id);
                      setIsFamilyVaultDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-medium flex items-center justify-between hover:bg-slate-50 cursor-pointer ${
                      fam.id === (activeFamilyId || currentFamily?.id)
                        ? 'text-[#2563EB] font-bold bg-blue-50/50'
                        : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate">{fam.name}</span>
                    {fam.id === (activeFamilyId || currentFamily?.id) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-[#475569] mt-0.5 font-normal">
            Pedigree lineage graph with generation alignment & spouse pairings
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Branch Filter Tabs with Left/Right Scroll (Shows 4 branches at a time including All Branches) */}
          <div className="flex items-center rounded-xl bg-white p-1 border-[1.5px] border-[#CBD5E1] text-xs shadow-xs">
            {/* Scroll Left Button */}
            <button
              type="button"
              data-testid="branch-scroll-left-button"
              onClick={() => handleScrollBranches('left')}
              aria-label="Scroll branches left"
              title="Scroll branches left"
              className="p-1 rounded-lg text-[#64748B] hover:text-[#2563EB] hover:bg-[#F1F5F9] transition-colors cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Scrollable Container with exact width showing 4 branches including All Branches */}
            <div
              ref={branchScrollRef}
              data-testid="branches-scroll-container"
              className="flex items-center gap-1.5 overflow-x-auto scroll-smooth w-[430px] max-w-[calc(100vw-240px)] select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              <button
                onClick={() => setSelectedBranch(null)}
                data-testid="branch-tab-all"
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 whitespace-nowrap text-xs ${
                  selectedBranch === null
                    ? 'bg-[#2563EB] text-white shadow-xs font-semibold'
                    : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                }`}
              >
                All Branches
              </button>
              {members.length > 0 &&
                branches.map((b) => (
                  <button
                    key={b.id}
                    data-testid={`branch-tab-${b.id}`}
                    onClick={() => setSelectedBranch(b.id)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer shrink-0 whitespace-nowrap text-xs ${
                      selectedBranch === b.id
                        ? 'bg-[#2563EB] text-white shadow-xs font-semibold'
                        : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
            </div>

            {/* Scroll Right Button */}
            <button
              type="button"
              data-testid="branch-scroll-right-button"
              onClick={() => handleScrollBranches('right')}
              aria-label="Scroll branches right"
              title="Scroll branches right"
              className="p-1 rounded-lg text-[#64748B] hover:text-[#2563EB] hover:bg-[#F1F5F9] transition-colors cursor-pointer shrink-0"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search & Jump with Dropdown */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#64748B]" />
            <input
              type="text"
              placeholder="Find relative in tree..."
              value={searchQuery}
              onFocus={() => setIsSearchDropdownOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchDropdownOpen(true);
              }}
              className="pl-8 pr-3 py-1.5 rounded-xl border-[1.5px] border-[#94A3B8] bg-white text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB] w-40 sm:w-56 shadow-xs"
            />

            {/* Quick search suggestion dropdown */}
            {isSearchDropdownOpen && searchResults.length > 0 && (
              <div
                className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl border-[1.5px] border-[#CBD5E1] shadow-lg z-50 overflow-hidden"
                onMouseDown={(e) => e.preventDefault()}
              >
                {searchResults.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleJumpToMember(m.id)}
                    className="w-full text-left px-3 py-2 hover:bg-[#F8FAFC] flex items-center gap-2 text-xs border-b border-[#E2E8F0]/70 last:border-none cursor-pointer"
                  >
                    <MemberAvatar
                      name={`${m.firstName} ${m.lastName}`}
                      src={m.profilePhoto || (m as any).profileImageUrl}
                      size="xs"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[#0F172A] truncate">
                        {m.displayName || `${m.firstName} ${m.lastName}`}
                      </div>
                      <div className="text-[10px] text-[#64748B]">
                        Gen {m.generation} • {m.branchName || 'Root'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {isSearchDropdownOpen && searchQuery.trim() && searchResults.length === 0 && (
              <div
                className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl border-[1.5px] border-[#CBD5E1] shadow-lg z-50 p-3 text-center text-xs text-[#64748B]"
                onMouseDown={(e) => e.preventDefault()}
              >
                No relatives found
              </div>
            )}
          </div>

          {/* Add Relative / Root Ancestor Button */}
          <Button
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs"
            onClick={async () => {
              let famId = currentFamily?.id || activeFamilyId || useFamilyStore.getState().activeFamilyId;
              if (!famId && availableFamilies.length > 0) {
                famId = availableFamilies[0].id;
                await setActiveFamilyId(famId);
              }

              if (!famId) {
                setIsCreateFamilyOpen(true);
                return;
              }
              if (members.length === 0) {
                setTargetReferenceMember(null);
                setIsAddRelationshipOpen(true);
              } else {
                setTargetReferenceMember(selectedMember || members[0] || null);
                setIsAddRelationshipOpen(true);
              }
            }}
          >
            {members.length === 0 ? 'Add Root Ancestor' : 'Add Relative'}
          </Button>

          {/* Ask Gemini Style Family Memories Sidebar Toggle Button */}
          <button
            type="button"
            data-testid="toggle-memories-sidebar-button"
            onClick={() => {
              if (activeDrawerMember) {
                setDrawerMember(null);
                setSelectedMember(null);
              }
              setIsMemoriesSidebarOpen((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs transition-all cursor-pointer shadow-xs ${
              isMemoriesSidebarOpen
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white ring-2 ring-indigo-200 shadow-sm'
                : 'bg-white hover:bg-slate-50 text-[#1E293B] border border-slate-300 hover:border-slate-400'
            }`}
            title="Toggle Memories Sidebar (Photos, Videos, Audios & Media)"
          >
            <span>Memories</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isMemoriesSidebarOpen ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'
              }`}
            >
              {memories.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Family Tree Canvas with pure white canvas background */}
      <div
        ref={containerRef}
        data-family-tree-container="true"
        className={`flex-1 relative bg-[#FFFFFF] transition-all duration-150 ${
          isFullscreen
            ? 'fixed inset-0 z-40 w-screen h-screen rounded-none border-none overflow-hidden'
            : 'rounded-2xl border border-[#B8D4FF] overflow-hidden shadow-xs'
        }`}
        style={{ backgroundColor: '#FFFFFF' }}
      >
        {/* No Active Vault Banner (shown only when no vault exists at all) */}
        {(!currentFamily?.id || currentFamily?.id === '') && availableFamilies.length === 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-white border-[1.5px] border-[#CBD5E1] text-[#17233C] px-4 py-2 rounded-xl text-xs shadow-md">
            <span className="text-[#475569]">
              No active family vault selected. Please establish a vault to record your lineage.
            </span>
            <button
              type="button"
              onClick={() => setIsCreateFamilyOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold cursor-pointer transition-colors"
            >
              Establish Vault
            </button>
          </div>
        )}

        {/* Active Lineage Path Highlight Banner */}
        {highlightedPathMemberIds.length > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-[#2563EB] text-white px-4 py-1.5 rounded-full font-medium text-xs shadow-md">
            <span className="font-semibold">
              Lineage Path Active: {highlightedPathMemberIds.length} relatives connected
            </span>
            <button
              type="button"
              onClick={() => setHighlightedPathMemberIds([])}
              className="px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold cursor-pointer transition-colors"
            >
              Clear Highlight
            </button>
          </div>
        )}

        {/* React Flow Canvas: Pure white canvas background */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.15}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
          style={{ backgroundColor: '#FFFFFF' }}
        >
          {/* Clean Subtle Dots Grid on Pure White Canvas */}
          <Background
            variant={BackgroundVariant.Dots}
            color="#E2E8F0"
            gap={24}
            size={1.5}
            className="opacity-70"
            style={{ backgroundColor: '#FFFFFF' }}
          />
        </ReactFlow>

        {/* Redesigned Floating Controls & Collapsible MiniMap (Requirements 8 & 9) */}
        {layoutResult.nodes.length > 0 && (
          <TreeFloatingControls
            onZoomIn={() => reactFlowInstance.zoomIn({ duration: 300 })}
            onZoomOut={() => reactFlowInstance.zoomOut({ duration: 300 })}
            onFitFamily={handleFitFamily}
            isFocusMode={isFocusMode}
            onToggleFocusMode={() => {
              if (isFocusMode) {
                setIsFocusMode(false);
                setSelectedMember(null);
              } else {
                if (activeDrawerMember) {
                  setSelectedMember(activeDrawerMember);
                }
                setIsFocusMode(true);
              }
            }}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            showMiniMap={showMiniMap}
            onToggleMiniMap={() => setShowMiniMap(!showMiniMap)}
            showHint={showHint}
            onDismissHint={() => setShowHint(false)}
            selectedMemberName={
              isFocusMode && selectedMember
                ? selectedMember.displayName || `${selectedMember.firstName} ${selectedMember.lastName}`
                : undefined
            }
            onClearFocus={isFocusMode || selectedMember ? handleClearFocus : undefined}
            isDrawerOpen={Boolean(activeDrawerMember) || isMemoriesSidebarOpen}
          />
        )}

        {/* Ask Gemini style floating side trigger tab */}
        {!isMemoriesSidebarOpen && !activeDrawerMember && (
          <button
            type="button"
            data-testid="floating-memories-tab-button"
            onClick={() => setIsMemoriesSidebarOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center bg-gradient-to-b from-blue-600 via-indigo-600 to-purple-600 text-white py-3 px-2 rounded-l-2xl shadow-xl hover:px-2.5 transition-all cursor-pointer group"
            title="Open Family Memories Sidebar (Photos, Videos, Audios & Media)"
          >
            <span className="[writing-mode:vertical-rl] text-[11px] font-bold tracking-wider select-none py-1">
              Memories ({memories.length})
            </span>
          </button>
        )}

        {/* Quick Inspect Member Detail Drawer with 5 organized sections */}
        <AnimatePresence>
          {activeDrawerMember && (
            <motion.div
              initial={{ x: 420, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 420, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 240 }}
              className="absolute right-0 top-0 bottom-0 w-84 sm:w-[420px] bg-white border-l-2 border-[#CBD5E1] p-6 shadow-xl z-30 overflow-y-auto"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3.5 border-b-[1.5px] border-[#CBD5E1]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#2563EB] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Relative Profile
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(activeDrawerMember)}
                    className="px-2.5 py-1 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Edit Member Profile"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerMember(null);
                      setSelectedMember(null);
                      setIsFocusMode(false);
                    }}
                    className="p-1 rounded-lg text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer"
                    title="Close Profile"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Member Core Identity */}
              <div className="mt-5 flex flex-col items-center text-center">
                <div className="relative group">
                  <MemberAvatar
                    name={`${activeDrawerMember.firstName} ${activeDrawerMember.lastName}`}
                    src={activeDrawerMember.profilePhoto || (activeDrawerMember as any).profileImageUrl}
                    gender={activeDrawerMember.gender}
                    member={activeDrawerMember}
                    size="xl"
                    isLiving={activeDrawerMember.isLiving}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPhotoMemberId(
                        editingPhotoMemberId === activeDrawerMember.id ? null : activeDrawerMember.id
                      );
                      setPhotoUrlInput(activeDrawerMember.profilePhoto || (activeDrawerMember as any).profileImageUrl || '');
                    }}
                    className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-md transition-colors cursor-pointer"
                    title="Change Photo URL"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                {editingPhotoMemberId === activeDrawerMember.id && (
                  <div
                    style={{ backgroundColor: 'rgb(255, 255, 30)' }}
                    className="mt-3 w-full p-3 rounded-xl border-[1.5px] border-[#B8D4FF] bg-[rgb(255,255,30)] text-left text-xs space-y-2 text-[#17233C]"
                  >
                    <label className="font-semibold text-[#17233C] block">
                      Direct Photo URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      value={photoUrlInput}
                      onChange={(e) => setPhotoUrlInput(e.target.value)}
                      className="w-full rounded-lg border-[1.5px] border-[#94A3B8] bg-white px-2.5 py-1.5 text-xs text-[#0F172A] focus:ring-1 focus:ring-[#2563EB] outline-none"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoUrlInput('');
                          handleSavePhotoUrl(activeDrawerMember.id, '');
                        }}
                        className="px-2 py-1 rounded-lg text-[11px] text-[#64748B] hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                        Reset to Default Logo
                      </button>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingPhotoMemberId(null)}
                          className="px-2 py-1 rounded-lg text-[11px] text-[#64748B] hover:bg-slate-200 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSavePhotoUrl(activeDrawerMember.id, photoUrlInput)}
                          disabled={isSavingPhoto}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer"
                        >
                          {isSavingPhoto ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <h3 className="text-lg font-bold text-[#0F172A] mt-3">
                  {activeDrawerMember.firstName} {activeDrawerMember.lastName}
                </h3>

                {activeDrawerMember.displayName && (
                  <p className="text-xs text-[#2563EB] italic mt-0.5">
                    &quot;{activeDrawerMember.displayName}&quot;
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5">
                  <Badge variant="sky">Gen {activeDrawerMember.generation}</Badge>
                  {activeDrawerMember.branchName &&
                    activeDrawerMember.branchName.trim().length > 0 &&
                    activeDrawerMember.branchName.toLowerCase() !== 'root lineage' &&
                    activeDrawerMember.branchName.toLowerCase() !== 'rootlineage' && (
                      <Badge variant="stone">{activeDrawerMember.branchName}</Badge>
                  )}
                  <Badge variant={activeDrawerMember.isLiving && !activeDrawerMember.dateOfDeath ? 'emerald' : 'stone'}>
                    {activeDrawerMember.isLiving && !activeDrawerMember.dateOfDeath ? 'Living' : 'Deceased'}
                  </Badge>
                </div>
              </div>

              {/* 5 Tab Navigation: Profile | Family | Memories | Timeline | Kinship */}
              <div className="grid grid-cols-5 gap-1 p-1 bg-[#F8FAFC] rounded-xl border-[1.5px] border-[#CBD5E1] mt-5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setDrawerTab('profile')}
                  className={`py-1.5 px-1 rounded-lg transition-colors flex flex-col items-center gap-0.5 cursor-pointer ${
                    drawerTab === 'profile'
                      ? 'bg-white text-[#2563EB] shadow-sm font-semibold'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('family')}
                  className={`py-1.5 px-1 rounded-lg transition-colors flex flex-col items-center gap-0.5 cursor-pointer ${
                    drawerTab === 'family'
                      ? 'bg-white text-[#2563EB] shadow-sm font-semibold'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5 text-rose-500" />
                  <span>Family</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('memories')}
                  className={`py-1.5 px-1 rounded-lg transition-colors flex flex-col items-center gap-0.5 cursor-pointer ${
                    drawerTab === 'memories'
                      ? 'bg-white text-[#2563EB] shadow-sm font-semibold'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Memories</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('timeline')}
                  className={`py-1.5 px-1 rounded-lg transition-colors flex flex-col items-center gap-0.5 cursor-pointer ${
                    drawerTab === 'timeline'
                      ? 'bg-white text-[#2563EB] shadow-sm font-semibold'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Timeline</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('kinship')}
                  className={`py-1.5 px-1 rounded-lg transition-colors flex flex-col items-center gap-0.5 cursor-pointer ${
                    drawerTab === 'kinship'
                      ? 'bg-white text-[#2563EB] shadow-sm font-semibold'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  <GitFork className="w-3.5 h-3.5 text-[#2563EB]" />
                  <span>Kinship</span>
                </button>
              </div>

              {/* Tab 1: Profile Information */}
              {drawerTab === 'profile' && (
                <div className="mt-4 space-y-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#F8FAFC] border-[1.5px] border-[#CBD5E1] space-y-2.5">
                    {drawerDateRows.length > 0 && (
                      <div className="space-y-1.5">
                        {drawerDateRows.map((row, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-[#0F172A]">
                            <Calendar className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                            <span className="font-semibold text-xs">
                              {row.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {activeDrawerMember.birthPlace && (
                      <div className="flex items-center gap-2 text-[#0F172A]">
                        <MapPin className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                        <span>Birthplace: {activeDrawerMember.birthPlace}</span>
                      </div>
                    )}
                    {activeDrawerMember.occupation && (
                      <div className="flex items-center gap-2 text-[#0F172A]">
                        <Briefcase className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                        <span>Occupation: {activeDrawerMember.occupation}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[#64748B] pt-1 border-t-[1.5px] border-[#E2E8F0]">
                      <span>Gender: <strong className="text-[#0F172A] capitalize">{activeDrawerMember.gender?.toLowerCase() || 'Unrecorded'}</strong></span>
                      {activeDrawerMember.branchName &&
                        activeDrawerMember.branchName.trim().length > 0 &&
                        activeDrawerMember.branchName.toLowerCase() !== 'root lineage' &&
                        activeDrawerMember.branchName.toLowerCase() !== 'rootlineage' && (
                          <>
                            <span>•</span>
                            <span>Branch: <strong className="text-[#0F172A]">{activeDrawerMember.branchName}</strong></span>
                          </>
                      )}
                    </div>
                  </div>

                  <div>
                    <h5 className="font-bold text-[#0F172A] mb-1.5 flex items-center justify-between">
                      <span>Biography & Stories</span>
                    </h5>
                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border-[1.5px] border-[#CBD5E1]">
                      <p className="text-[#475569] leading-relaxed text-xs">
                        {activeDrawerMember.biography || 'No biographical stories recorded for this relative yet.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(activeDrawerMember)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-[1.5px] border-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1D4ED8] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit Member Profile</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 2: Family Information (with Add Child & Add Spouse actions) */}
              {drawerTab === 'family' && (
                <div className="mt-4 space-y-4 text-xs">
                  {/* Functional Quick Actions */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 flex flex-col gap-1">
                      <button
                        type="button"
                        disabled={!activeDrawerMember || !memberHasSpouse(activeDrawerMember.id)}
                        onClick={() => handleOpenAddRelative(activeDrawerMember!, 'CHILD')}
                        title={
                          activeDrawerMember && memberHasSpouse(activeDrawerMember.id)
                            ? 'Add Child'
                            : 'Add a spouse before adding a child.'
                        }
                        className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors ${
                          activeDrawerMember && memberHasSpouse(activeDrawerMember.id)
                            ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer'
                            : 'opacity-45 cursor-not-allowed bg-slate-200 text-slate-500'
                        }`}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Add Child</span>
                      </button>
                      {activeDrawerMember && !memberHasSpouse(activeDrawerMember.id) && (
                        <p className="text-[10px] text-amber-600 font-medium text-center">
                          Add a spouse before adding a child.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenAddRelative(activeDrawerMember!, 'SPOUSE')}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white text-[#2563EB] border-[1.5px] border-[#2563EB] hover:bg-[#EFF6FF] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <Heart className="w-3.5 h-3.5" />
                      <span>+ Add Spouse</span>
                    </button>
                  </div>

                  {/* Immediate Relatives Lists */}
                  <div className="space-y-3.5">
                    {/* Parents */}
                    <div className="p-3 rounded-xl bg-[#F8FAFC] border-[1.5px] border-[#CBD5E1]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-[#0F172A]">
                          Parents ({immediateRelatives.parents.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenAddRelative(activeDrawerMember, 'PARENT')}
                          className="text-[11px] font-medium text-[#2563EB] hover:underline cursor-pointer"
                        >
                          + Add Parent
                        </button>
                      </div>
                      {immediateRelatives.parents.length > 0 ? (
                        <div className="space-y-1.5">
                          {immediateRelatives.parents.map((p) => {
                            const pRows = getNodeDateRows(p);
                            return (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setDrawerMember(p);
                                  setDrawerTab('profile');
                                }}
                                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors"
                              >
                                <MemberAvatar name={`${p.firstName} ${p.lastName}`} src={p.profilePhoto} gender={p.gender} member={p} size="sm" isLiving={p.isLiving} />
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-[#0F172A] truncate">{p.firstName} {p.lastName}</p>
                                  <div className="text-[10px] text-[#64748B] space-y-0.5">
                                    {pRows.length > 0 ? (
                                      pRows.map((r, i) => <div key={i}>{r.text}</div>)
                                    ) : (
                                      <div>No dates recorded</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#64748B] italic">No parents recorded.</p>
                      )}
                    </div>

                    {/* Spouses */}
                    <div className="p-3 rounded-xl bg-[#F8FAFC] border-[1.5px] border-[#CBD5E1]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-[#0F172A]">
                          Spouse & Partners ({immediateRelatives.spouses.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenAddRelative(activeDrawerMember, 'SPOUSE')}
                          className="text-[11px] font-medium text-[#2563EB] hover:underline cursor-pointer"
                        >
                          + Add Spouse
                        </button>
                      </div>
                      {immediateRelatives.spouses.length > 0 ? (
                        <div className="space-y-1.5">
                          {immediateRelatives.spouses.map((s) => {
                            const isSpouseDeceased = !s.isLiving || Boolean(s.dateOfDeath);
                            const spouseRel = activeDrawerMember
                              ? relationships.find(
                                  (r) =>
                                    r.relationshipType === 'SPOUSE' &&
                                    ((r.sourceMemberId === activeDrawerMember.id && r.targetMemberId === s.id) ||
                                      (r.sourceMemberId === s.id && r.targetMemberId === activeDrawerMember.id))
                                )
                              : null;
                            const marriageDateStr =
                              spouseRel?.marriageDate || (spouseRel?.metadata as any)?.marriageDate;
                            const sRows = getNodeDateRows(s, !isSpouseDeceased ? marriageDateStr : null);

                            return (
                              <div key={s.id} className="space-y-1">
                                <div
                                  onClick={() => {
                                    setDrawerMember(s);
                                    setDrawerTab('profile');
                                  }}
                                  className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors group/item"
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <MemberAvatar
                                      name={`${s.firstName} ${s.lastName}`}
                                      src={s.profilePhoto}
                                      gender={s.gender}
                                      member={s}
                                      size="sm"
                                      isLiving={s.isLiving}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-[#0F172A] truncate">
                                        {s.firstName} {s.lastName}
                                      </p>
                                      <div className="text-[10px] text-[#64748B] space-y-0.5">
                                        {sRows.length > 0 ? (
                                          sRows.map((r, i) => <div key={i}>{r.text}</div>)
                                        ) : (
                                          <div>No dates recorded</div>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {spouseRel && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (editingSpouseRelId === spouseRel.id) {
                                          setEditingSpouseRelId(null);
                                        } else {
                                          setEditingSpouseRelId(spouseRel.id);
                                          const raw = spouseRel.marriageDate || (spouseRel.metadata as any)?.marriageDate || '';
                                          const formatted = raw.includes('T') ? raw.split('T')[0] : raw.slice(0, 10);
                                          setSpouseMarriageDateInput(formatted);
                                        }
                                      }}
                                      className="p-1 rounded text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors cursor-pointer shrink-0"
                                      title="Edit Marriage Date"
                                      aria-label="Edit Marriage Date"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>

                                {spouseRel && editingSpouseRelId === spouseRel.id && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ backgroundColor: 'rgb(255, 255, 30)' }}
                                    className="p-2.5 rounded-xl border-[1.5px] border-[#B8D4FF] bg-[rgb(255,255,30)] text-xs space-y-2 shadow-xs text-[#17233C]"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-[11px] text-[#17233C]">
                                        Marriage Date (DOM)
                                      </span>
                                      <span className="text-[10px] text-[#64748B]">Updates both spouses</span>
                                    </div>
                                    <input
                                      type="date"
                                      value={spouseMarriageDateInput}
                                      onChange={(e) => setSpouseMarriageDateInput(e.target.value)}
                                      className="w-full rounded-lg border-[1.5px] border-[#CBD5E1] bg-white px-2 py-1 text-xs text-[#0F172A] outline-none focus:ring-1 focus:ring-[#2563EB]"
                                    />
                                    <div className="flex items-center justify-end gap-1.5 pt-0.5">
                                      <button
                                        type="button"
                                        onClick={() => setEditingSpouseRelId(null)}
                                        className="px-2 py-1 rounded-md text-[11px] text-[#64748B] hover:bg-slate-100 cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isUpdatingSpouseRel || !spouseMarriageDateInput.trim()}
                                        onClick={() => {
                                          if (!spouseMarriageDateInput.trim()) {
                                            toastError('Marriage date (DOM) is compulsory for a spouse.');
                                            return;
                                          }
                                          handleSaveSpouseMarriageDate(spouseRel.id, spouseMarriageDateInput);
                                        }}
                                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                                      >
                                        {isUpdatingSpouseRel ? 'Saving...' : 'Save DOM'}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#64748B] italic">No spouse recorded.</p>
                      )}
                    </div>

                    {/* Children */}
                    <div className="p-3 rounded-xl bg-[#F8FAFC] border-[1.5px] border-[#CBD5E1]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-[#0F172A]">
                          Children ({immediateRelatives.children.length})
                        </span>
                        <button
                          type="button"
                          disabled={!activeDrawerMember || !memberHasSpouse(activeDrawerMember.id)}
                          onClick={() => handleOpenAddRelative(activeDrawerMember!, 'CHILD')}
                          title={
                            activeDrawerMember && memberHasSpouse(activeDrawerMember.id)
                              ? 'Add Child'
                              : 'Add a spouse before adding a child.'
                          }
                          className={`text-[11px] font-medium transition-colors ${
                            activeDrawerMember && memberHasSpouse(activeDrawerMember.id)
                              ? 'text-[#2563EB] hover:underline cursor-pointer'
                              : 'text-slate-400 cursor-not-allowed opacity-50'
                          }`}
                        >
                          + Add Child
                        </button>
                      </div>
                      {immediateRelatives.children.length > 0 ? (
                        <div className="space-y-1.5">
                          {immediateRelatives.children.map((c) => {
                            const cRows = getNodeDateRows(c);
                            return (
                              <div
                                key={c.id}
                                onClick={() => {
                                  setDrawerMember(c);
                                  setDrawerTab('profile');
                                }}
                                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors"
                              >
                                <MemberAvatar name={`${c.firstName} ${c.lastName}`} src={c.profilePhoto} gender={c.gender} member={c} size="sm" isLiving={c.isLiving} />
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-[#0F172A] truncate">{c.firstName} {c.lastName}</p>
                                  <div className="text-[10px] text-[#64748B] space-y-0.5">
                                    <div>Gen {c.generation}</div>
                                    {cRows.length > 0 ? (
                                      cRows.map((r, i) => <div key={i}>{r.text}</div>)
                                    ) : (
                                      <div>No dates recorded</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#64748B] italic">No children recorded.</p>
                      )}
                    </div>

                    {/* Siblings */}
                    {immediateRelatives.siblings.length > 0 && (
                      <div className="p-3 rounded-xl bg-[#F8FAFC] border-[1.5px] border-[#CBD5E1]">
                        <span className="font-bold text-[#0F172A] block mb-2">
                          Siblings ({immediateRelatives.siblings.length})
                        </span>
                        <div className="space-y-1.5">
                          {immediateRelatives.siblings.map((sib) => {
                            const sibRows = getNodeDateRows(sib);
                            return (
                              <div
                                key={sib.id}
                                onClick={() => {
                                  setDrawerMember(sib);
                                  setDrawerTab('profile');
                                }}
                                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors"
                              >
                                <MemberAvatar name={`${sib.firstName} ${sib.lastName}`} src={sib.profilePhoto} gender={sib.gender} member={sib} size="sm" isLiving={sib.isLiving} />
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-[#0F172A] truncate">{sib.firstName} {sib.lastName}</p>
                                  <div className="text-[10px] text-[#64748B] space-y-0.5">
                                    {sibRows.length > 0 ? (
                                      sibRows.map((r, i) => <div key={i}>{r.text}</div>)
                                    ) : (
                                      <div>No dates recorded</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Memories */}
              {drawerTab === 'memories' && (
                <div className="mt-4 space-y-3 text-xs">
                  {(() => {
                    const memberMemories = memories.filter(
                      (m) =>
                        m.memberIds?.includes(activeDrawerMember.id) ||
                        (m as any).relatedMemberIds?.includes(activeDrawerMember.id)
                    );
                    if (memberMemories.length === 0) {
                      return (
                        <div className="p-6 rounded-xl bg-[#F8FAFC] border-[1.5px] border-[#CBD5E1] text-center">
                          <ImageIcon className="w-8 h-8 text-[#64748B] mx-auto mb-2 opacity-50" />
                          <h6 className="font-bold text-[#0F172A]">No memories tagged</h6>
                          <p className="text-[11px] text-[#64748B] mt-1">
                            Memories and photos tagged with {activeDrawerMember.firstName} will appear here.
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        {memberMemories.map((mem) => (
                          <div
                            key={mem.id}
                            className="p-3 rounded-xl bg-[#F8FAFC] border-[1.5px] border-[#CBD5E1] flex items-start gap-3"
                          >
                            {mem.media?.[0]?.url || (mem as any).mediaUrl ? (
                              <img
                                src={mem.media?.[0]?.url || (mem as any).mediaUrl}
                                alt={mem.title}
                                className="w-12 h-12 rounded-lg object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
                                <ImageIcon className="w-5 h-5 text-[#2563EB]" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h6 className="font-bold text-[#0F172A] truncate">{mem.title}</h6>
                              <p className="text-[10px] text-[#64748B] mt-0.5 line-clamp-2">
                                {mem.description || mem.date || 'Preserved family keepsake'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Tab 4: Timeline */}
              {drawerTab === 'timeline' && (
                <div className="mt-4 space-y-4 text-xs">
                  <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E2E8F0]">
                    {/* DOB & Arrival */}
                    <div className="relative">
                      <span className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-[#2563EB] ring-4 ring-white" />
                      <div className="font-bold text-[#0F172A]">DOB & Arrival</div>
                      <div className="text-[11px] text-[#475569] mt-0.5">
                        DOB: {formatSingleDate(activeDrawerMember.dateOfBirth) || 'Date unrecorded'} • {activeDrawerMember.birthPlace || 'Location unrecorded'}
                      </div>
                    </div>

                    {/* Occupation */}
                    {activeDrawerMember.occupation && (
                      <div className="relative">
                        <span className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-[#3B82F6] ring-4 ring-white" />
                        <div className="font-bold text-[#0F172A]">Vocation & Career</div>
                        <div className="text-[11px] text-[#475569] mt-0.5">
                          {activeDrawerMember.occupation}
                        </div>
                      </div>
                    )}

                    {/* Spousal Union if any */}
                    {immediateRelatives.spouses.length > 0 && (
                      <div className="relative">
                        <span className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-rose-500 ring-4 ring-white" />
                        <div className="font-bold text-[#0F172A]">Marriage & Union</div>
                        <div className="text-[11px] text-[#475569] mt-0.5">
                          United with {immediateRelatives.spouses.map((s) => `${s.firstName} ${s.lastName}`).join(', ')}
                        </div>
                      </div>
                    )}

                    {/* Resting Fact if deceased */}
                    {!activeDrawerMember.isLiving && (
                      <div className="relative">
                        <span className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-[#94A3B8] ring-4 ring-white" />
                        <div className="font-bold text-[#0F172A]">Resting</div>
                        <div className="text-[11px] text-[#475569] mt-0.5">
                          Date of passing: {formatSingleDate(activeDrawerMember.dateOfDeath) || 'Unrecorded'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 5: Kinship */}
              {drawerTab === 'kinship' && (
                <div className="mt-4 space-y-3 text-xs">
                  <div className="space-y-2">
                    <label className="font-semibold text-[#0F172A] block text-xs">
                      Select Target Relative
                    </label>
                    <select
                      value={kinshipTargetId}
                      onChange={(e) => {
                        setKinshipTargetId(e.target.value);
                        setKinshipResult(null);
                      }}
                      className="w-full rounded-xl border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs text-[#0F172A] focus:ring-2 focus:ring-[#2563EB] focus:outline-none"
                    >
                      <option value="">Select target relative...</option>
                      {members
                        .filter((m) => m.id !== activeDrawerMember.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.displayName || `${m.firstName} ${m.lastName}`} (Gen {m.generation})
                          </option>
                        ))}
                    </select>

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      disabled={!kinshipTargetId || isCalculatingKinship}
                      onClick={handleCalculateKinship}
                    >
                      {isCalculatingKinship ? 'Computing Path...' : 'Calculate Kinship Path'}
                    </Button>

                    {kinshipResult && (
                      <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#0F172A]">
                            {kinshipResult.relationship.replace(/_/g, ' ')}
                          </span>
                          <Badge size="sm" variant="sky">
                            {kinshipResult.distance} {kinshipResult.distance === 1 ? 'degree' : 'degrees'}
                          </Badge>
                        </div>
                        {kinshipResult.path && kinshipResult.path.length > 0 && (
                          <div className="text-[11px] text-[#475569] space-y-1 border-t border-[#E2E8F0] pt-2">
                            {kinshipResult.path.map((p, idx) => (
                              <div key={idx} className="flex items-center gap-1.5">
                                <span className="font-medium text-[#0F172A]">{p.fromName}</span>
                                <span className="font-bold text-[#2563EB]">→ {p.step} →</span>
                                <span className="font-medium text-[#0F172A]">{p.toName}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <Button
                          size="sm"
                          className="w-full text-xs mt-2"
                          onClick={() => {
                            if (kinshipTargetId) {
                              setHighlightedPathMemberIds([selectedMember.id, kinshipTargetId]);
                            }
                          }}
                        >
                          Highlight Path on Canvas
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ask Gemini Style Right Sidebar: Family Memories, Photos, Videos, Audios & Media Information */}
        <MemoriesSidePanel
          isOpen={isMemoriesSidebarOpen}
          onClose={() => setIsMemoriesSidebarOpen(false)}
          memories={memories}
          members={members}
          familyName={formatFamilyDisplayName(currentFamily?.name)}
          onSelectMember={(memberId) => {
            handleJumpToMember(memberId);
          }}
          onOpenUploadModal={() => {
            handleOpenUploadMemoryModal(null);
          }}
          onRefreshMemories={() => {
            const famId = currentFamily?.id || activeFamilyId;
            if (famId) {
              fetchMemories(famId);
            }
          }}
        />
      </div>

      {/* Add Relative / Relationship Modal */}
      <AddMemberModal
        isOpen={isAddRelationshipOpen}
        onClose={() => setIsAddRelationshipOpen(false)}
        onSubmit={handleAddRelationshipSubmit}
        isRootAncestor={members.length === 0 || (!targetReferenceMember && !selectedMember)}
        referenceMember={targetReferenceMember || selectedMember}
        referenceMemberHasSpouse={
          (targetReferenceMember || selectedMember)
            ? memberHasSpouse((targetReferenceMember || selectedMember)!.id)
            : false
        }
        initialRelationshipType={relationshipType}
        branches={branches}
        isSubmitting={isSubmitting}
        isFullscreen={isFullscreen}
        onRestoreFullscreen={restoreFullscreen}
      />

      {/* Edit Member Profile Modal */}
      <AddMemberModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditModalMember(null);
        }}
        onSubmit={async () => {}}
        onEditSubmit={handleEditMemberSubmit}
        editMember={editModalMember}
        existingMarriageDate={editModalSpouseMarriageDate}
        hasSpouse={editModalMember ? memberHasSpouse(editModalMember.id) : false}
        isRootAncestor={false}
        branches={branches}
        isSubmitting={isUpdatingMember}
        isFullscreen={isFullscreen}
        onRestoreFullscreen={restoreFullscreen}
      />

      {/* Dedicated Edit Life Status Modal */}
      <EditLifeStatusModal
        isOpen={isLifeStatusModalOpen}
        onClose={() => {
          setIsLifeStatusModalOpen(false);
          setLifeStatusModalMember(null);
        }}
        member={lifeStatusModalMember}
        onSave={handleSaveLifeStatus}
        isLoading={isUpdatingLifeStatus}
      />

      {/* Phase 30: Establish Family Vault Modal */}
      <CreateFamilyModal
        isOpen={isCreateFamilyOpen}
        onClose={() => setIsCreateFamilyOpen(false)}
        onSuccess={() => {
          setIsAddRelationshipOpen(true);
        }}
      />

      {/* Phase 41: Full-Size Profile Photo Lightbox */}
      {photoViewerState && (
        <ProfilePhotoLightboxModal
          isOpen={Boolean(photoViewerState)}
          onClose={() => setPhotoViewerState(null)}
          member={photoViewerState.member}
          photoUrl={photoViewerState.photoUrl}
        />
      )}

      {/* Upload Memory Modal from Tree Nodes (Photos and Videos visible in Memories Section) */}
      {isMemoryUploadModalOpen && memoryUploadMember && (currentFamily?.id || activeFamilyId) && (
        <UploadNodeMemoryModal
          isOpen={isMemoryUploadModalOpen}
          member={memoryUploadMember}
          familyId={currentFamily?.id || activeFamilyId}
          onClose={() => {
            setIsMemoryUploadModalOpen(false);
            setMemoryUploadMember(null);
          }}
          onSuccess={() => {
            const famId = currentFamily?.id || activeFamilyId;
            if (famId) {
              fetchFamilyTree(famId);
              fetchMemories(famId);
            }
          }}
        />
      )}
    </div>
  );
};

export const FamilyTreePage: React.FC = () => {
  return (
    <ReactFlowProvider>
      <FamilyTreeInner />
    </ReactFlowProvider>
  );
};
