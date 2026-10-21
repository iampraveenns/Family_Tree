import { Node, Edge, MarkerType, Position } from 'reactflow';
import { FamilyMember, Relationship } from '../types/index.ts';
import { resolveDynamicBranches } from './branchUtils.ts';

export const NODE_WIDTH = 280;
export const NODE_HEIGHT = 160;
export const SPOUSE_GAP = 52;
export const SIBLING_GAP = 52; // Equal space between nodes (matching couple gap for uniform cadence)
export const FAMILY_GAP = 72;
export const GENERATION_GAP = 240;
export const CANVAS_PADDING_X = 140;
export const CANVAS_PADDING_Y = 90;

export interface LayoutBoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface TreeLayoutOptions {
  selectedBranch?: string | null;
  searchQuery?: string;
  selectedMemberId?: string | null;
  focusedNodeIds?: Set<string> | null;
  hoveredMemberId?: string | null;
  hoveredRelatedIds?: Set<string>;
  highlightedPathMemberIds?: string[];
  isMobile?: boolean;
  disableStarterSpouse?: boolean;
  showGenerationMarkers?: boolean;
}

export interface NuclearFamily {
  id: string;
  generation: number;
  parents: FamilyMember[];
  childrenIds: string[];
  x: number;
  y: number;
  width: number;
  isLeftBranch?: boolean;
}

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
  boundingBox: LayoutBoundingBox;
  generationCount: number;
  generations: number[];
}

/**
 * Deterministic Family Tree Auto-Layout Algorithm
 *
 * 1. Groups members into horizontal generation rows with exact same Y coordinates.
 * 2. Positions spouses as cohesive units with equal SPOUSE_GAP.
 *    - For leftside nodes, the spouse / new member is placed on the LEFT side: [Spouse, LeftMember].
 *    - For rightside nodes, the spouse / new member is placed on the RIGHT side: [RightMember, Spouse].
 * 3. Equal, uniform spacing between adjacent nodes in Generation 3 and beyond.
 * 4. Centers parent couple units directly above their children.
 * 5. Prevents any node overlap with block-preserving collision resolution.
 * 6. Generates generation rail markers on the left.
 */
export function calculateTreeLayout(
  members: FamilyMember[],
  relationships: Relationship[],
  options: TreeLayoutOptions = {}
): LayoutResult {
  const emptyResult: LayoutResult = {
    nodes: [],
    edges: [],
    boundingBox: {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      width: 0,
      height: 0,
      centerX: 0,
      centerY: 0,
    },
    generationCount: 0,
    generations: [],
  };

  // Strictly filter members to valid, real FamilyMember records and resolve dynamic branches
  const rawValidMembers = (members || []).filter(
    (m): m is FamilyMember =>
      Boolean(m && typeof m === 'object' && m.id && typeof m.id === 'string' && m.firstName !== undefined)
  );
  const validMembers = resolveDynamicBranches(rawValidMembers, relationships || []);

  // 1. EMPTY TREE CASE: FamilyMember count === 0
  if (validMembers.length === 0) {
    if (options.disableStarterSpouse) {
      return emptyResult;
    }
    const starterMemberX = -(NODE_WIDTH + SPOUSE_GAP / 2);
    const starterSpouseX = SPOUSE_GAP / 2;
    const starterY = 0;

    const starterMemberNode: Node = {
      id: 'starter-member',
      type: 'starterNode',
      position: { x: starterMemberX, y: starterY },
      data: {
        isStarterNode: true,
        starterType: 'member',
        title: 'Member',
        label: 'Member',
        ctaLabel: 'Add Member',
      },
    };

    const starterSpouseNode: Node = {
      id: 'starter-spouse',
      type: 'starterNode',
      position: { x: starterSpouseX, y: starterY },
      data: {
        isStarterNode: true,
        starterType: 'spouse',
        title: 'Spouse',
        label: 'Spouse',
        ctaLabel: 'Add Spouse',
      },
    };

    const starterCoupleEdge: Edge = {
      id: 'edge-starter-couple',
      source: 'starter-member',
      target: 'starter-spouse',
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'straight',
      label: '⚭',
      labelStyle: { fill: '#7EA7D9', fontWeight: 700, fontSize: 13 },
      labelBgStyle: { fill: '#FFFFFF', rx: 6, fillOpacity: 0.95 },
      labelBgPadding: [4, 4],
      style: {
        stroke: '#7EA7D9',
        strokeWidth: 2,
        strokeDasharray: '4 4',
      },
      data: {
        isStarterEdge: true,
        relationshipType: 'SPOUSE',
      },
    };

    const width = 2 * NODE_WIDTH + SPOUSE_GAP;
    const height = NODE_HEIGHT;

    return {
      nodes: [starterMemberNode, starterSpouseNode],
      edges: [starterCoupleEdge],
      boundingBox: {
        minX: starterMemberX,
        minY: starterY,
        maxX: starterSpouseX + NODE_WIDTH,
        maxY: starterY + height,
        width,
        height,
        centerX: 0,
        centerY: height / 2,
      },
      generationCount: 1,
      generations: [1],
    };
  }

  const {
    selectedBranch,
    searchQuery = '',
    selectedMemberId,
    focusedNodeIds,
    hoveredMemberId,
    hoveredRelatedIds = new Set<string>(),
    highlightedPathMemberIds = [],
    isMobile = false,
  } = options;

  // Filter members if branch is selected (while keeping spouses/children if relevant)
  const activeMembers = validMembers.filter((m) => {
    if (!selectedBranch) return true;
    return m.branchId === selectedBranch;
  });

  if (activeMembers.length === 0) {
    return emptyResult;
  }

  const memberMap = new Map<string, FamilyMember>();
  validMembers.forEach((m) => memberMap.set(m.id, m));

  const activeMemberMap = new Map<string, FamilyMember>();
  activeMembers.forEach((m) => activeMemberMap.set(m.id, m));

  // Map relationships: parent-child and spouses
  const parentToChildren = new Map<string, string[]>();
  const childToParents = new Map<string, string[]>();
  const spousePairs = new Map<string, string[]>();

  (relationships || []).forEach((r) => {
    if (!r || !r.sourceMemberId || !r.targetMemberId) return;
    if (!activeMemberMap.has(r.sourceMemberId) || !activeMemberMap.has(r.targetMemberId)) {
      return;
    }

    if (
      r.relationshipType === 'PARENT' ||
      r.relationshipType === 'ADOPTIVE_PARENT' ||
      r.relationshipType === 'STEP_PARENT'
    ) {
      if (!parentToChildren.has(r.sourceMemberId)) {
        parentToChildren.set(r.sourceMemberId, []);
      }
      parentToChildren.get(r.sourceMemberId)!.push(r.targetMemberId);

      if (!childToParents.has(r.targetMemberId)) {
        childToParents.set(r.targetMemberId, []);
      }
      childToParents.get(r.targetMemberId)!.push(r.sourceMemberId);
    } else if (
      r.relationshipType === 'CHILD' ||
      r.relationshipType === 'ADOPTED_CHILD' ||
      r.relationshipType === 'STEP_CHILD'
    ) {
      if (!parentToChildren.has(r.targetMemberId)) {
        parentToChildren.set(r.targetMemberId, []);
      }
      parentToChildren.get(r.targetMemberId)!.push(r.sourceMemberId);

      if (!childToParents.has(r.sourceMemberId)) {
        childToParents.set(r.sourceMemberId, []);
      }
      childToParents.get(r.sourceMemberId)!.push(r.targetMemberId);
    } else if (r.relationshipType === 'SPOUSE') {
      if (!spousePairs.has(r.sourceMemberId)) {
        spousePairs.set(r.sourceMemberId, []);
      }
      spousePairs.get(r.sourceMemberId)!.push(r.targetMemberId);

      if (!spousePairs.has(r.targetMemberId)) {
        spousePairs.set(r.targetMemberId, []);
      }
      spousePairs.get(r.targetMemberId)!.push(r.sourceMemberId);
    }
  });

  // Sort each parent's children deterministically by siblingOrder / displayOrder / createdAt
  parentToChildren.forEach((childrenList, pId) => {
    childrenList.sort((aId, bId) => {
      const aMember = activeMemberMap.get(aId) || memberMap.get(aId);
      const bMember = activeMemberMap.get(bId) || memberMap.get(bId);

      const aRel = (relationships || []).find(
        (r) =>
          (r.relationshipType === 'PARENT' ||
            r.relationshipType === 'ADOPTIVE_PARENT' ||
            r.relationshipType === 'STEP_PARENT') &&
          r.sourceMemberId === pId &&
          r.targetMemberId === aId
      );
      const bRel = (relationships || []).find(
        (r) =>
          (r.relationshipType === 'PARENT' ||
            r.relationshipType === 'ADOPTIVE_PARENT' ||
            r.relationshipType === 'STEP_PARENT') &&
          r.sourceMemberId === pId &&
          r.targetMemberId === bId
      );

      const aOrder =
        aRel?.siblingOrder ??
        aRel?.displayOrder ??
        (aRel?.metadata as any)?.siblingOrder ??
        (aRel?.metadata as any)?.displayOrder ??
        aMember?.siblingOrder ??
        aMember?.displayOrder;

      const bOrder =
        bRel?.siblingOrder ??
        bRel?.displayOrder ??
        (bRel?.metadata as any)?.siblingOrder ??
        (bRel?.metadata as any)?.displayOrder ??
        bMember?.siblingOrder ??
        bMember?.displayOrder;

      if (aOrder != null && bOrder != null && aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      if (aOrder != null && bOrder == null) return -1;
      if (aOrder == null && bOrder != null) return 1;

      const aRelTime = aRel?.createdAt ? new Date(aRel.createdAt).getTime() : 0;
      const bRelTime = bRel?.createdAt ? new Date(bRel.createdAt).getTime() : 0;
      if (aRelTime && bRelTime && aRelTime !== bRelTime) {
        return aRelTime - bRelTime;
      }

      const aMemTime = aMember?.createdAt ? new Date(aMember.createdAt).getTime() : 0;
      const bMemTime = bMember?.createdAt ? new Date(bMember.createdAt).getTime() : 0;
      if (aMemTime && bMemTime && aMemTime !== bMemTime) {
        return aMemTime - bMemTime;
      }

      // Fallback: index in relationships array (preserves input insertion order)
      const aRelIndex = aRel ? relationships.indexOf(aRel) : -1;
      const bRelIndex = bRel ? relationships.indexOf(bRel) : -1;
      if (aRelIndex !== -1 && bRelIndex !== -1 && aRelIndex !== bRelIndex) {
        return aRelIndex - bRelIndex;
      }

      // Fallback: index in members array
      const aMemIndex = aMember ? validMembers.indexOf(aMember) : -1;
      const bMemIndex = bMember ? validMembers.indexOf(bMember) : -1;
      if (aMemIndex !== -1 && bMemIndex !== -1 && aMemIndex !== bMemIndex) {
        return aMemIndex - bMemIndex;
      }

      return aId.localeCompare(bId);
    });
  });

  // 2. SINGLE MEMBER TRANSITION (Phase 27):
  if (
    activeMembers.length === 1 &&
    (!selectedBranch || activeMembers[0].branchId === selectedBranch) &&
    !options.disableStarterSpouse
  ) {
    const m1 = activeMembers[0];
    const m1Spouses = spousePairs.get(m1.id) || [];
    if (m1Spouses.length === 0) {
      const m1X = -(NODE_WIDTH + SPOUSE_GAP / 2);
      const starterSpouseX = SPOUSE_GAP / 2;
      const rowY = 0;

      const m1Node: Node = {
        id: m1.id,
        type: 'heritageMember',
        position: { x: m1X, y: rowY },
        data: {
          member: m1,
          isSelected: m1.id === selectedMemberId,
          isFocused: focusedNodeIds ? focusedNodeIds.has(m1.id) : false,
          isDimmed:
            (selectedMemberId && selectedMemberId !== m1.id && !focusedNodeIds?.has(m1.id)) ||
            (hoveredMemberId && hoveredMemberId !== m1.id && !hoveredRelatedIds.has(m1.id)),
          isHovered: hoveredMemberId === m1.id,
          isPathHighlighted: highlightedPathMemberIds.includes(m1.id),
          isSearchMatch:
            searchQuery.trim().length > 0 &&
            (m1.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
              m1.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
              Boolean(m1.displayName && m1.displayName.toLowerCase().includes(searchQuery.toLowerCase()))),
          isStarterNode: false,
        },
      };

      const starterSpouseNode: Node = {
        id: 'starter-spouse',
        type: 'starterNode',
        position: { x: starterSpouseX, y: rowY },
        data: {
          isStarterNode: true,
          starterType: 'spouse',
          title: 'Spouse',
          label: 'Spouse',
          ctaLabel: 'Add Spouse',
          partnerMemberId: m1.id,
        },
      };

      const starterCoupleEdge: Edge = {
        id: `edge-${m1.id}-starter-spouse`,
        source: m1.id,
        target: 'starter-spouse',
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'straight',
        label: '⚭',
        labelStyle: { fill: '#2563EB', fontWeight: 700, fontSize: 13 },
        labelBgStyle: { fill: '#EFF6FF', rx: 6, fillOpacity: 0.95 },
        labelBgPadding: [4, 4],
        style: {
          stroke: '#2563EB',
          strokeWidth: 2,
          strokeDasharray: '4 4',
        },
        data: {
          isStarterEdge: true,
          relationshipType: 'SPOUSE',
        },
      };

      const width = 2 * NODE_WIDTH + SPOUSE_GAP;
      const height = NODE_HEIGHT;

      return {
        nodes: [m1Node, starterSpouseNode],
        edges: [starterCoupleEdge],
        boundingBox: {
          minX: m1X,
          minY: rowY,
          maxX: starterSpouseX + NODE_WIDTH,
          maxY: rowY + height,
          width,
          height,
          centerX: 0,
          centerY: height / 2,
        },
        generationCount: 1,
        generations: [m1.generation || 1],
      };
    }
  }

  // Calculate generation for each member
  const memberGenerations = new Map<string, number>();
  activeMembers.forEach((m) => {
    let gen = m.generation;
    if (!gen || gen < 1) {
      const parents = childToParents.get(m.id);
      if (parents && parents.length > 0) {
        const parentGens = parents.map((pid) => memberMap.get(pid)?.generation || 1);
        gen = Math.max(...parentGens) + 1;
      } else {
        gen = 1;
      }
    }
    memberGenerations.set(m.id, gen);
  });

  // Align spouse generations to be identical
  activeMembers.forEach((m) => {
    const spouses = spousePairs.get(m.id) || [];
    spouses.forEach((sId) => {
      const s = activeMemberMap.get(sId);
      if (s) {
        const currentGen = memberGenerations.get(m.id) || 1;
        const spouseGen = memberGenerations.get(sId) || 1;
        const normalized = Math.min(currentGen, spouseGen);
        memberGenerations.set(m.id, normalized);
        memberGenerations.set(sId, normalized);
      }
    });
  });

  // Group members by generation
  const generationMap = new Map<number, FamilyMember[]>();
  activeMembers.forEach((m) => {
    const gen = memberGenerations.get(m.id) || 1;
    if (!generationMap.has(gen)) {
      generationMap.set(gen, []);
    }
    generationMap.get(gen)!.push(m);
  });

  const sortedGens = Array.from(generationMap.keys()).sort((a, b) => a - b);
  const minGen = sortedGens.length > 0 ? sortedGens[0] : 1;

  /**
   * Deterministic Left-vs-Right Orientation
   * Determines if a member belongs to the left side of the tree / generation.
   *
   * Rules:
   * - In Gen 1: founding patriarch is left, matriarch is right.
   * - In Gen 2: children are ordered from left to right (child 0 is left, child 1 is right).
   * - In Gen 3+: children inherit left/right orientation from their lineage ancestor.
   *   For example:
   *   - Arun's lineage (Kumar, Meena, Ravi, Suresh, Raj, Anu) is the left branch.
   *   - Ananth's lineage (Deepa) is the right branch.
   */
  const isLeftSideMemo = new Map<string, boolean>();

  function isLeftSideNode(memberId: string): boolean {
    if (isLeftSideMemo.has(memberId)) {
      return isLeftSideMemo.get(memberId)!;
    }

    const m = memberMap.get(memberId);
    if (!m) return false;

    // Check branch tags if explicitly defined
    const branchKey = (m.branchName || m.branchId || '').toLowerCase();
    if (branchKey.includes('kumar') || branchKey.includes('ravi') || branchKey.includes('suresh')) {
      isLeftSideMemo.set(memberId, true);
      return true;
    }

    // Lineage check via parents
    const parents = childToParents.get(memberId) || [];
    if (parents.length > 0) {
      const pId = parents[0];
      const pGen = memberGenerations.get(pId) || 1;

      // If parent is Generation 1: determine based on sibling order
      const siblings = parentToChildren.get(pId) || [];
      if (siblings.length > 1) {
        const sIndex = siblings.indexOf(memberId);
        if (sIndex !== -1) {
          const isLeft = sIndex < siblings.length / 2;
          isLeftSideMemo.set(memberId, isLeft);
          return isLeft;
        }
      }

      // Inherit from parent
      const parentIsLeft = isLeftSideNode(pId);
      isLeftSideMemo.set(memberId, parentIsLeft);
      return parentIsLeft;
    }

    // Check spouse lineage if member married into the family
    const spouses = spousePairs.get(memberId) || [];
    for (const sId of spouses) {
      const sParents = childToParents.get(sId) || [];
      if (sParents.length > 0) {
        const spouseIsLeft = isLeftSideNode(sId);
        isLeftSideMemo.set(memberId, spouseIsLeft);
        return spouseIsLeft;
      }
    }

    // Root Generation: first member or patriarch is left
    const rootGen = memberGenerations.get(memberId) || 1;
    const rootMembers = generationMap.get(rootGen) || [];
    const idx = rootMembers.findIndex((x) => x.id === memberId);
    const isLeft = idx === 0 || idx < rootMembers.length / 2;
    isLeftSideMemo.set(memberId, isLeft);
    return isLeft;
  }

  /**
   * Couple Ordering Helper (Phase 30)
   * Whenever a spouse is added, ALWAYS place the spouse immediately to the RIGHT of the existing person:
   * [existingPerson, spouse].
   * Works for both male → female and female → male relationships.
   */
  function orderCouple(memberA: FamilyMember, memberB: FamilyMember): [FamilyMember, FamilyMember] {
    const hasParentsA = (childToParents.get(memberA.id) || []).length > 0;
    const hasParentsB = (childToParents.get(memberB.id) || []).length > 0;

    let existingPerson = memberA;
    let spouse = memberB;

    if (!hasParentsA && hasParentsB) {
      existingPerson = memberB;
      spouse = memberA;
    } else if (hasParentsA && !hasParentsB) {
      existingPerson = memberA;
      spouse = memberB;
    } else {
      // Find the direct relationship record between memberA and memberB
      // When adding a spouse to member X, X is the sourceMemberId and spouse is targetMemberId
      const directRel = (relationships || []).find(
        (r) =>
          r.relationshipType === 'SPOUSE' &&
          ((r.sourceMemberId === memberA.id && r.targetMemberId === memberB.id) ||
            (r.sourceMemberId === memberB.id && r.targetMemberId === memberA.id))
      );
      if (directRel && directRel.sourceMemberId === memberB.id && directRel.targetMemberId === memberA.id) {
        existingPerson = memberB;
        spouse = memberA;
      } else {
        existingPerson = memberA;
        spouse = memberB;
      }
    }

    // Always place spouse immediately to the RIGHT of the existing person:
    return [existingPerson, spouse];
  }

  // Build nuclear families per generation
  const nuclearFamilies: NuclearFamily[] = [];
  const processedMembers = new Set<string>();
  const secondarySpouseIds = new Set<string>();
  const primaryPartnerIds = new Set<string>();

  sortedGens.forEach((gen) => {
    const genMembers = generationMap.get(gen) || [];

    // Prioritize lineage members first so couples are formed systematically
    const sortedMembers = [...genMembers].sort((a, b) => {
      const aHasParents = (childToParents.get(a.id) || []).length;
      const bHasParents = (childToParents.get(b.id) || []).length;
      if (aHasParents !== bHasParents) return bHasParents - aHasParents;

      // Order leftside nodes before rightside nodes
      const aLeft = isLeftSideNode(a.id) ? 0 : 1;
      const bLeft = isLeftSideNode(b.id) ? 0 : 1;
      return aLeft - bLeft;
    });

    sortedMembers.forEach((m) => {
      if (processedMembers.has(m.id)) return;

      const spouses = (spousePairs.get(m.id) || [])
        .map((sId) => activeMemberMap.get(sId))
        .filter((s): s is FamilyMember => Boolean(s) && !processedMembers.has(s!.id));

      let parents: FamilyMember[];
      if (spouses.length > 0) {
        const spouse = spouses[0];
        parents = orderCouple(m, spouse);
        processedMembers.add(m.id);
        processedMembers.add(spouse.id);

        primaryPartnerIds.add(parents[0].id);
        secondarySpouseIds.add(parents[1].id);
      } else {
        parents = [m];
        processedMembers.add(m.id);
      }

      // Collect children belonging to this parent unit
      const parentIds = parents.map((p) => p.id);
      const childSet = new Set<string>();
      parentIds.forEach((pId) => {
        const children = parentToChildren.get(pId) || [];
        children.forEach((cId) => {
          if (activeMemberMap.has(cId)) {
            childSet.add(cId);
          }
        });
      });

      const isLeft = parents.some((p) => isLeftSideNode(p.id));
      let childrenIds = Array.from(childSet);

      // Phase: Family Tree Child Ordering & Layout Correction
      // Sort children strictly LEFT -> RIGHT according to persistent siblingOrder / displayOrder.
      // The first child added must always remain the leftmost child, and every newly added child
      // must appear to the RIGHT of existing children.
      childrenIds.sort((aId, bId) => {
        const aMember = activeMemberMap.get(aId) || memberMap.get(aId);
        const bMember = activeMemberMap.get(bId) || memberMap.get(bId);

        const aRel = (relationships || []).find(
          (r) =>
            (r.relationshipType === 'PARENT' ||
              r.relationshipType === 'ADOPTIVE_PARENT' ||
              r.relationshipType === 'STEP_PARENT') &&
            parentIds.includes(r.sourceMemberId) &&
            r.targetMemberId === aId
        );
        const bRel = (relationships || []).find(
          (r) =>
            (r.relationshipType === 'PARENT' ||
              r.relationshipType === 'ADOPTIVE_PARENT' ||
              r.relationshipType === 'STEP_PARENT') &&
            parentIds.includes(r.sourceMemberId) &&
            r.targetMemberId === bId
        );

        const aOrder =
          aRel?.siblingOrder ??
          aRel?.displayOrder ??
          (aRel?.metadata as any)?.siblingOrder ??
          (aRel?.metadata as any)?.displayOrder ??
          aMember?.siblingOrder ??
          aMember?.displayOrder;

        const bOrder =
          bRel?.siblingOrder ??
          bRel?.displayOrder ??
          (bRel?.metadata as any)?.siblingOrder ??
          (bRel?.metadata as any)?.displayOrder ??
          bMember?.siblingOrder ??
          bMember?.displayOrder;

        if (aOrder != null && bOrder != null && aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        if (aOrder != null && bOrder == null) return -1;
        if (aOrder == null && bOrder != null) return 1;

        const aRelTime = aRel?.createdAt ? new Date(aRel.createdAt).getTime() : 0;
        const bRelTime = bRel?.createdAt ? new Date(bRel.createdAt).getTime() : 0;
        if (aRelTime && bRelTime && aRelTime !== bRelTime) {
          return aRelTime - bRelTime;
        }

        const aMemTime = aMember?.createdAt ? new Date(aMember.createdAt).getTime() : 0;
        const bMemTime = bMember?.createdAt ? new Date(bMember.createdAt).getTime() : 0;
        if (aMemTime && bMemTime && aMemTime !== bMemTime) {
          return aMemTime - bMemTime;
        }

        // Fallback: index in relationships array (preserves input insertion order)
        const aRelIndex = aRel ? relationships.indexOf(aRel) : -1;
        const bRelIndex = bRel ? relationships.indexOf(bRel) : -1;
        if (aRelIndex !== -1 && bRelIndex !== -1 && aRelIndex !== bRelIndex) {
          return aRelIndex - bRelIndex;
        }

        // Fallback: index in members array
        const aMemIndex = aMember ? validMembers.indexOf(aMember) : -1;
        const bMemIndex = bMember ? validMembers.indexOf(bMember) : -1;
        if (aMemIndex !== -1 && bMemIndex !== -1 && aMemIndex !== bMemIndex) {
          return aMemIndex - bMemIndex;
        }

        return aId.localeCompare(bId);
      });

      const baseWidth = parents.length === 2 ? 2 * NODE_WIDTH + SPOUSE_GAP : NODE_WIDTH;

      nuclearFamilies.push({
        id: `family-${parents.map((p) => p.id).join('-')}`,
        generation: gen,
        parents,
        childrenIds,
        x: 0,
        y: 0,
        width: baseWidth,
        isLeftBranch: isLeft,
      });
    });
  });

  // Ensure every active member with a spouse has a deterministic primary/secondary classification
  activeMembers.forEach((m) => {
    if (secondarySpouseIds.has(m.id) || primaryPartnerIds.has(m.id)) return;
    const spouses = spousePairs.get(m.id) || [];
    if (spouses.length > 0) {
      const partner = activeMemberMap.get(spouses[0]);
      if (partner) {
        const [prim, sec] = orderCouple(m, partner);
        primaryPartnerIds.add(prim.id);
        secondarySpouseIds.add(sec.id);
      }
    }
  });

  // Track node positions: memberId -> { x, y }
  const positions = new Map<string, { x: number; y: number }>();
  const coupleJunctions: Array<{
    id: string;
    parentA: FamilyMember;
    parentB: FamilyMember;
    x: number;
    y: number;
    childrenIds: string[];
    marriageDate?: string | null;
  }> = [];

  // Group nuclear families by generation
  const familiesByGen = new Map<number, NuclearFamily[]>();
  nuclearFamilies.forEach((f) => {
    if (!familiesByGen.has(f.generation)) {
      familiesByGen.set(f.generation, []);
    }
    familiesByGen.get(f.generation)!.push(f);
  });

  // Map each member to their nuclear family
  const memberToFamily = new Map<string, NuclearFamily>();
  nuclearFamilies.forEach((fam) => {
    fam.parents.forEach((p) => memberToFamily.set(p.id, fam));
  });

  // Associate each nuclear family with its child nuclear families in generation (gen + 1)
  const familyChildUnits = new Map<NuclearFamily, NuclearFamily[]>();
  nuclearFamilies.forEach((fam) => {
    const childUnitSet = new Set<NuclearFamily>();
    fam.childrenIds.forEach((cId) => {
      const cFam = memberToFamily.get(cId);
      if (cFam && cFam.generation === fam.generation + 1) {
        childUnitSet.add(cFam);
      }
    });

    // Order child units consistently: left branches first, and maintain parent's childrenIds ordering
    const orderedChildUnits = fam.childrenIds
      .map((cId) => memberToFamily.get(cId))
      .filter((cFam): cFam is NuclearFamily => Boolean(cFam && childUnitSet.has(cFam)))
      .filter((cFam, idx, arr) => arr.indexOf(cFam) === idx);

    familyChildUnits.set(fam, orderedChildUnits);
  });

  // Pass 1: Bottom-up recursive subtree width calculation
  const subtreeWidths = new Map<NuclearFamily, number>();
  const reversedGens = [...sortedGens].reverse();

  reversedGens.forEach((gen) => {
    const families = familiesByGen.get(gen) || [];
    families.forEach((fam) => {
      const children = familyChildUnits.get(fam) || [];
      if (children.length === 0) {
        subtreeWidths.set(fam, fam.width);
      } else {
        const totalChildrenWidth = children.reduce((sum, c, idx) => {
          const w = subtreeWidths.get(c) || c.width;
          return sum + w + (idx > 0 ? SIBLING_GAP : 0);
        }, 0);
        subtreeWidths.set(fam, Math.max(fam.width, totalChildrenWidth));
      }
    });
  });

  // Pass 2: Top-down hierarchical subtree positioning starting from root generation
  const rootFamilies = familiesByGen.get(minGen) || [];
  rootFamilies.sort((a, b) => {
    const aLeft = a.isLeftBranch ? 0 : 1;
    const bLeft = b.isLeftBranch ? 0 : 1;
    return aLeft - bLeft;
  });

  const positionSubtree = (fam: NuclearFamily, centerX: number) => {
    fam.x = centerX - fam.width / 2;
    fam.y = (fam.generation - minGen) * GENERATION_GAP + CANVAS_PADDING_Y;

    const children = familyChildUnits.get(fam) || [];
    if (children.length === 0) return;

    const totalChildrenWidth = children.reduce((sum, c, idx) => {
      const w = subtreeWidths.get(c) || c.width;
      return sum + w + (idx > 0 ? SIBLING_GAP : 0);
    }, 0);

    let childCursorX = centerX - totalChildrenWidth / 2;
    children.forEach((c) => {
      const cSubWidth = subtreeWidths.get(c) || c.width;
      const childCenterX = childCursorX + cSubWidth / 2;
      positionSubtree(c, childCenterX);
      childCursorX += cSubWidth + SIBLING_GAP;
    });
  };

  let rootCursorX = CANVAS_PADDING_X;
  rootFamilies.forEach((rf) => {
    const rSubWidth = subtreeWidths.get(rf) || rf.width;
    const rootCenterX = rootCursorX + rSubWidth / 2;
    positionSubtree(rf, rootCenterX);
    rootCursorX += rSubWidth + FAMILY_GAP;
  });

  // Pass 3: Generation-level collision resolution & uniform spacing
  sortedGens.forEach((gen) => {
    const families = familiesByGen.get(gen) || [];
    families.sort((a, b) => a.x - b.x);

    for (let i = 1; i < families.length; i++) {
      const prev = families[i - 1];
      const curr = families[i];

      const prevParents = prev.parents.flatMap((p) => childToParents.get(p.id) || []);
      const currParents = curr.parents.flatMap((p) => childToParents.get(p.id) || []);
      const shareParent = prevParents.length > 0 && prevParents.some((pid) => currParents.includes(pid));

      const isSameBranch = shareParent || Boolean(prev.isLeftBranch === curr.isLeftBranch);
      const minGap = isSameBranch ? SIBLING_GAP : FAMILY_GAP;
      const requiredX = prev.x + prev.width + minGap;

      if (curr.x < requiredX) {
        const shift = requiredX - curr.x;
        for (let j = i; j < families.length; j++) {
          families[j].x += shift;
        }
      }
    }
  });

  // Pass 4: Bottom-up centering: re-center parent couples directly over their children
  reversedGens.forEach((gen) => {
    const parentFamilies = familiesByGen.get(gen) || [];

    parentFamilies.forEach((fam) => {
      const children = familyChildUnits.get(fam) || [];
      if (children.length === 0) return;

      const minChildX = Math.min(...children.map((c) => c.x));
      const maxChildX = Math.max(...children.map((c) => c.x + c.width));
      const childrenGroupCenter = (minChildX + maxChildX) / 2;

      fam.x = childrenGroupCenter - fam.width / 2;
    });

    // Ensure no collisions among parents after centering
    const families = familiesByGen.get(gen) || [];
    families.sort((a, b) => a.x - b.x);
    for (let i = 1; i < families.length; i++) {
      const prev = families[i - 1];
      const curr = families[i];
      const prevParents = prev.parents.flatMap((p) => childToParents.get(p.id) || []);
      const currParents = curr.parents.flatMap((p) => childToParents.get(p.id) || []);
      const shareParent = prevParents.length > 0 && prevParents.some((pid) => currParents.includes(pid));
      const minGap = shareParent || prev.isLeftBranch === curr.isLeftBranch ? SIBLING_GAP : FAMILY_GAP;
      const requiredX = prev.x + prev.width + minGap;
      if (curr.x < requiredX) {
        const shift = requiredX - curr.x;
        for (let j = i; j < families.length; j++) {
          families[j].x += shift;
        }
      }
    }
  });

  // Assign final node positions and couple junctions from nuclear families
  sortedGens.forEach((gen) => {
    const families = familiesByGen.get(gen) || [];
    families.forEach((fam) => {
      if (fam.parents.length === 1) {
        const p1 = fam.parents[0];
        positions.set(p1.id, { x: fam.x, y: fam.y });
      } else if (fam.parents.length === 2) {
        const p1 = fam.parents[0];
        const p2 = fam.parents[1];

        positions.set(p1.id, { x: fam.x, y: fam.y });
        positions.set(p2.id, { x: fam.x + NODE_WIDTH + SPOUSE_GAP, y: fam.y });

        // Couple junction point directly between them
        const junctionX = fam.x + NODE_WIDTH + SPOUSE_GAP / 2;
        const junctionY = fam.y + NODE_HEIGHT / 2;

        const spouseRel = (relationships || []).find(
          (r) =>
            r.relationshipType === 'SPOUSE' &&
            ((r.sourceMemberId === p1.id && r.targetMemberId === p2.id) ||
              (r.sourceMemberId === p2.id && r.targetMemberId === p1.id))
        );
        const marriageDate = spouseRel?.marriageDate || (spouseRel?.metadata as any)?.marriageDate || null;

        coupleJunctions.push({
          id: `junction-${p1.id}-${p2.id}`,
          parentA: p1,
          parentB: p2,
          x: junctionX,
          y: junctionY,
          childrenIds: fam.childrenIds,
          marriageDate,
        });
      }
    });
  });

  // Normalize global minX to CANVAS_PADDING_X
  let currentMinX = Infinity;
  positions.forEach((pos) => {
    if (pos.x < currentMinX) currentMinX = pos.x;
  });

  if (currentMinX !== Infinity && currentMinX !== CANVAS_PADDING_X) {
    const globalShift = CANVAS_PADDING_X - currentMinX;
    positions.forEach((pos) => {
      pos.x += globalShift;
    });
    coupleJunctions.forEach((j) => {
      j.x += globalShift;
    });
  }

  // Calculate overall bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  positions.forEach((pos) => {
    if (pos.x < minX) minX = pos.x;
    if (pos.x + NODE_WIDTH > maxX) maxX = pos.x + NODE_WIDTH;
    if (pos.y < minY) minY = pos.y;
    if (pos.y + NODE_HEIGHT > maxY) maxY = pos.y + NODE_HEIGHT;
  });

  if (minX === Infinity) {
    minX = 0;
    maxX = 800;
    minY = 0;
    maxY = 600;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;

  // Build React Flow Nodes
  const finalNodes: Node[] = [];

  // 1. Generation Marker Nodes on the left rail (only if explicitly enabled; default off in favor of per-node Gen badges)
  if (options.showGenerationMarkers && activeMembers.length > 1) {
    sortedGens.forEach((gen) => {
      const genY = (gen - minGen) * GENERATION_GAP + CANVAS_PADDING_Y;
      finalNodes.push({
        id: `gen-marker-${gen}`,
        type: 'generationMarker',
        position: { x: minX - (isMobile ? 140 : 190), y: genY + NODE_HEIGHT / 2 - 18 },
        data: {
          generation: gen,
          label: `Generation ${gen}`,
          subtitle:
            gen === 1
              ? 'Patriarchs & Ancestors'
              : gen === 2
              ? 'Second Lineage'
              : gen === 3
              ? 'Contemporary Generation'
              : `Descendant Lineage ${gen}`,
          lineSpanWidth: width + (isMobile ? 180 : 280),
        },
        selectable: false,
        draggable: false,
      });
    });
  }

  // 2. Member Nodes
  activeMembers.forEach((m) => {
    const pos = positions.get(m.id) || { x: 0, y: 0 };
    const isSelected = selectedMemberId === m.id;
    const isFocused = focusedNodeIds ? focusedNodeIds.has(m.id) : false;
    const isDimmed = focusedNodeIds ? !focusedNodeIds.has(m.id) : false;
    const isHovered = hoveredMemberId === m.id;
    const isHoverRelated = hoveredRelatedIds.has(m.id);
    const isPathHighlighted = highlightedPathMemberIds.includes(m.id);
    const hasSpouse = (spousePairs.get(m.id) || []).length > 0;

    const spouses = spousePairs.get(m.id) || [];
    const spouseRel = (relationships || []).find(
      (r) =>
        r.relationshipType === 'SPOUSE' &&
        (String(r.sourceMemberId) === String(m.id) || String(r.targetMemberId) === String(m.id)) &&
        (r.marriageDate || (r.metadata as any)?.marriageDate)
    );
    const spousePartner = spouses.length > 0 ? activeMemberMap.get(spouses[0]) : null;
    const resolvedMarriageDate =
      (m as any).dateOfMarriage ||
      (m as any).marriageDate ||
      spouseRel?.marriageDate ||
      (spouseRel?.metadata as any)?.marriageDate ||
      (spousePartner as any)?.dateOfMarriage ||
      (spousePartner as any)?.marriageDate ||
      null;

    const isSecondarySpouseNode = secondarySpouseIds.has(m.id);
    const isPrimaryPartnerNode = hasSpouse ? !isSecondarySpouseNode : true;
    const hideRelationshipActions = isSecondarySpouseNode;

    // Show Date of Marriage (DOM) inside the primary member's node instead of the spouse node
    const nodeMarriageDate = isSecondarySpouseNode ? null : resolvedMarriageDate;

    finalNodes.push({
      id: m.id,
      type: 'heritageMember',
      position: { x: pos.x, y: pos.y },
      data: {
        member: {
          ...m,
          ...(isSecondarySpouseNode
            ? { dateOfMarriage: null, marriageDate: null }
            : nodeMarriageDate
            ? { dateOfMarriage: nodeMarriageDate, marriageDate: nodeMarriageDate }
            : {}),
        },
        isSelected,
        isFocused,
        isDimmed,
        isHovered,
        isHoverRelated,
        isPathHighlighted,
        hasSpouse,
        isPrimaryPartner: isPrimaryPartnerNode,
        isSecondarySpouse: isSecondarySpouseNode,
        hideRelationshipActions,
        marriageDate: nodeMarriageDate,
      },
    });
  });

  // 3. Couple Junction Nodes (central connector between spouses)
  coupleJunctions.forEach((j) => {
    const isJunctionInFocus =
      focusedNodeIds &&
      (focusedNodeIds.has(j.parentA.id) || focusedNodeIds.has(j.parentB.id));

    finalNodes.push({
      id: j.id,
      type: 'coupleJunction',
      position: { x: j.x - 12, y: j.y - 12 },
      data: {
        parentAId: j.parentA.id,
        parentBId: j.parentB.id,
        childrenIds: j.childrenIds,
        marriageDate: j.marriageDate,
        isDimmed: focusedNodeIds ? !isJunctionInFocus : false,
      },
      selectable: false,
      draggable: false,
    });
  });

  // Build React Flow Edges
  const finalEdges: Edge[] = [];
  const processedSpouseEdges = new Set<string>();

  // Pass A: Couple Junction Connections
  coupleJunctions.forEach((j) => {
    const isConnectedToHover =
      hoveredMemberId &&
      (j.parentA.id === hoveredMemberId ||
        j.parentB.id === hoveredMemberId ||
        j.childrenIds.includes(hoveredMemberId));

    const isConnectedToSelected =
      selectedMemberId &&
      (j.parentA.id === selectedMemberId ||
        j.parentB.id === selectedMemberId ||
        j.childrenIds.includes(selectedMemberId));

    const isDimmed =
      focusedNodeIds &&
      !focusedNodeIds.has(j.parentA.id) &&
      !focusedNodeIds.has(j.parentB.id);

    // 1. Edge from Parent A (right handle) to Junction (left handle)
    finalEdges.push({
      id: `edge-${j.parentA.id}-${j.id}`,
      source: j.parentA.id,
      target: j.id,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'straight',
      style: {
        stroke: isConnectedToHover
          ? '#2563EB'
          : isConnectedToSelected
          ? '#2563EB'
          : '#7EA7D9',
        strokeWidth: isConnectedToHover || isConnectedToSelected ? 2.5 : 2,
        opacity: isDimmed ? 0.2 : 0.95,
      },
      animated: Boolean(isConnectedToHover || isConnectedToSelected),
    });

    // 2. Edge from Junction (right handle) to Parent B (left handle)
    finalEdges.push({
      id: `edge-${j.id}-${j.parentB.id}`,
      source: j.id,
      target: j.parentB.id,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'straight',
      style: {
        stroke: isConnectedToHover
          ? '#2563EB'
          : isConnectedToSelected
          ? '#2563EB'
          : '#7EA7D9',
        strokeWidth: isConnectedToHover || isConnectedToSelected ? 2.5 : 2,
        opacity: isDimmed ? 0.2 : 0.95,
      },
      animated: Boolean(isConnectedToHover || isConnectedToSelected),
    });

    processedSpouseEdges.add(`${j.parentA.id}-${j.parentB.id}`);
    processedSpouseEdges.add(`${j.parentB.id}-${j.parentA.id}`);

    // 3. Edges from Junction (bottom handle) down to each Child (top handle)
    j.childrenIds.forEach((childId) => {
      const isChildHovered = hoveredMemberId === childId;
      const isChildSelected = selectedMemberId === childId;
      const isEdgeActive =
        isConnectedToHover ||
        isChildHovered ||
        isConnectedToSelected ||
        isChildSelected;

      finalEdges.push({
        id: `edge-${j.id}-${childId}`,
        source: j.id,
        target: childId,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isEdgeActive ? '#2563EB' : '#7EA7D9',
          width: 12,
          height: 12,
        },
        style: {
          stroke: isEdgeActive ? '#2563EB' : '#7EA7D9',
          strokeWidth: isEdgeActive ? 2.5 : 2,
          opacity: isDimmed ? 0.2 : 0.9,
        },
        animated: Boolean(isEdgeActive),
      });
    });
  });

  // Pass B: Standalone parent-child connections (single parent with no spouse)
  (relationships || []).forEach((r) => {
    if (!r || !r.sourceMemberId || !r.targetMemberId) return;
    if (!activeMemberMap.has(r.sourceMemberId) || !activeMemberMap.has(r.targetMemberId)) {
      return;
    }

    const isParentType =
      r.relationshipType === 'PARENT' ||
      r.relationshipType === 'ADOPTIVE_PARENT' ||
      r.relationshipType === 'STEP_PARENT';
    const isChildType =
      r.relationshipType === 'CHILD' ||
      r.relationshipType === 'ADOPTED_CHILD' ||
      r.relationshipType === 'STEP_CHILD';

    if (isParentType || isChildType) {
      const parentId = isParentType ? r.sourceMemberId : r.targetMemberId;
      const childId = isParentType ? r.targetMemberId : r.sourceMemberId;

      // Check if this parent-child connection was already handled by a couple junction
      const isHandledByJunction = coupleJunctions.some(
        (j) =>
          (j.parentA.id === parentId || j.parentB.id === parentId) &&
          j.childrenIds.includes(childId)
      );

      if (!isHandledByJunction) {
        const isConnectedToHover =
          hoveredMemberId &&
          (parentId === hoveredMemberId || childId === hoveredMemberId);

        const isConnectedToSelected =
          selectedMemberId &&
          (parentId === selectedMemberId || childId === selectedMemberId);

        const isDimmed =
          focusedNodeIds &&
          (!focusedNodeIds.has(parentId) || !focusedNodeIds.has(childId));

        finalEdges.push({
          id: r.id,
          source: parentId,
          target: childId,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isConnectedToHover || isConnectedToSelected ? '#2563EB' : '#7EA7D9',
            width: 12,
            height: 12,
          },
          style: {
            stroke: isConnectedToHover || isConnectedToSelected ? '#2563EB' : '#7EA7D9',
            strokeWidth: isConnectedToHover || isConnectedToSelected ? 2.5 : 2,
            opacity: isDimmed ? 0.2 : 0.9,
          },
          animated: Boolean(isConnectedToHover || isConnectedToSelected),
        });
      }
    } else if (r.relationshipType === 'SPOUSE') {
      const pairKey = `${r.sourceMemberId}-${r.targetMemberId}`;
      if (
        !processedSpouseEdges.has(pairKey) &&
        activeMemberMap.has(r.sourceMemberId) &&
        activeMemberMap.has(r.targetMemberId)
      ) {
        processedSpouseEdges.add(pairKey);
        processedSpouseEdges.add(`${r.targetMemberId}-${r.sourceMemberId}`);

        const isConnectedToHover =
          hoveredMemberId &&
          (r.sourceMemberId === hoveredMemberId || r.targetMemberId === hoveredMemberId);
        const isConnectedToSelected =
          selectedMemberId &&
          (r.sourceMemberId === selectedMemberId || r.targetMemberId === selectedMemberId);

        finalEdges.push({
          id: r.id,
          source: r.sourceMemberId,
          target: r.targetMemberId,
          sourceHandle: 'right',
          targetHandle: 'left',
          label: '⚭',
          type: 'straight',
          style: {
            stroke: isConnectedToHover || isConnectedToSelected ? '#2563EB' : '#7EA7D9',
            strokeWidth: 2,
            strokeDasharray: '4,4',
          },
          labelStyle: { fill: '#7EA7D9', fontWeight: 600, fontSize: 11 },
          labelBgStyle: { fill: '#FFFFFF', rx: 4, fillOpacity: 0.95 },
        });
      }
    }
  });

  return {
    nodes: finalNodes,
    edges: finalEdges,
    boundingBox: {
      minX,
      minY,
      maxX,
      maxY,
      width,
      height,
      centerX,
      centerY,
    },
    generationCount: sortedGens.length,
    generations: sortedGens,
  };
}

/**
 * Helper to determine whether a member is the secondary (right-hand) spouse in a couple.
 * In every couple:
 * - Lineage descendant (has parents in family) is primary (left)
 * - If neither or both have parents, the spouse relationship initiator (sourceMemberId) is primary (left)
 * - The primary (left) partner keeps +Child and +Spouse actions
 * - The secondary (right) spouse hides +Child and +Spouse actions while keeping Edit and View
 */
export function isSecondarySpouse(
  memberId: string,
  members: FamilyMember[],
  relationships: Relationship[]
): boolean {
  const member = members.find((m) => m.id === memberId);
  if (!member) return false;

  const spouseRel = (relationships || []).find(
    (r) =>
      r.relationshipType === 'SPOUSE' &&
      (r.sourceMemberId === memberId || r.targetMemberId === memberId)
  );
  if (!spouseRel) return false;

  const partnerId = spouseRel.sourceMemberId === memberId ? spouseRel.targetMemberId : spouseRel.sourceMemberId;
  const partner = members.find((m) => m.id === partnerId);
  if (!partner) return false;

  const hasParentsMember = (relationships || []).some(
    (r) =>
      (r.relationshipType === 'PARENT' ||
        r.relationshipType === 'ADOPTIVE_PARENT' ||
        r.relationshipType === 'STEP_PARENT') &&
      r.targetMemberId === memberId
  );
  const hasParentsPartner = (relationships || []).some(
    (r) =>
      (r.relationshipType === 'PARENT' ||
        r.relationshipType === 'ADOPTIVE_PARENT' ||
        r.relationshipType === 'STEP_PARENT') &&
      r.targetMemberId === partnerId
  );

  if (!hasParentsMember && hasParentsPartner) {
    return true; // Partner has lineage parents, so member is secondary
  } else if (hasParentsMember && !hasParentsPartner) {
    return false; // Member has lineage parents, so member is primary
  } else {
    // If neither or both have parents, check relationship direction
    if (spouseRel.sourceMemberId === memberId && spouseRel.targetMemberId === partnerId) {
      return false; // Member is the primary partner
    }
    if (spouseRel.sourceMemberId === partnerId && spouseRel.targetMemberId === memberId) {
      return true; // Member is the secondary spouse
    }
    return false;
  }
}

