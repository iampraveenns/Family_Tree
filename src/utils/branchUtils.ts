import { FamilyMember, Relationship } from '../types/index.ts';

/**
 * Dynamically resolves and assigns branch names to all family members.
 *
 * Rules:
 * 1. For every member, a branch is dynamically assigned if not already present.
 * 2. If a child has a spouse (a couple), that group (both the child and their spouse, and their descendants) forms a branch.
 *    - The branch name is based on the lineage child (e.g., `${child.firstName} Branch` or child.branchName).
 *    - Both the child and their spouse are assigned this same branch.
 * 3. Children of that couple inherit their parents' branch (unless they grow up, marry, and form their own couple branch).
 * 4. Root ancestor(s) and any unmarried members also dynamically receive their branch (e.g. `${root.firstName} Branch`).
 */
export function resolveDynamicBranches(
  members: FamilyMember[],
  relationships: Relationship[] = []
): FamilyMember[] {
  if (!members || members.length === 0) return [];

  const memberMap = new Map<string, FamilyMember>();
  members.forEach((m) => memberMap.set(m.id, { ...m }));

  // Build parent-child relationships and spouse pairs
  const parentToChildren = new Map<string, string[]>();
  const childToParents = new Map<string, string[]>();
  const spouseOf = new Map<string, string>();

  (relationships || []).forEach((r) => {
    if (!r || !r.sourceMemberId || !r.targetMemberId) return;
    const src = r.sourceMemberId.toString();
    const tgt = r.targetMemberId.toString();

    if (
      r.relationshipType === 'PARENT' ||
      r.relationshipType === 'ADOPTIVE_PARENT' ||
      r.relationshipType === 'STEP_PARENT'
    ) {
      if (!parentToChildren.has(src)) parentToChildren.set(src, []);
      parentToChildren.get(src)!.push(tgt);

      if (!childToParents.has(tgt)) childToParents.set(tgt, []);
      childToParents.get(tgt)!.push(src);
    } else if (
      r.relationshipType === 'CHILD' ||
      r.relationshipType === 'ADOPTED_CHILD' ||
      r.relationshipType === 'STEP_CHILD'
    ) {
      if (!parentToChildren.has(tgt)) parentToChildren.set(tgt, []);
      parentToChildren.get(tgt)!.push(src);

      if (!childToParents.has(src)) childToParents.set(src, []);
      childToParents.get(src)!.push(tgt);
    } else if (r.relationshipType === 'SPOUSE') {
      spouseOf.set(src, tgt);
      spouseOf.set(tgt, src);
    }
  });

  // Track assigned branch names: memberId -> branchName
  const branchAssignments = new Map<string, string>();

  // Helper to format branch name from a person's name
  const makeBranchName = (m: FamilyMember): string => {
    if (
      m.branchName &&
      m.branchName.trim() &&
      m.branchName.toLowerCase() !== 'root lineage' &&
      m.branchName.toLowerCase() !== 'rootlineage'
    ) {
      return m.branchName.trim();
    }
    const cleanName = (m.displayName || `${m.firstName} ${m.lastName}`).trim() || m.firstName || 'Family';
    if (cleanName.toLowerCase().endsWith('branch')) {
      return cleanName;
    }
    return `${cleanName}'s Family Branch`;
  };

  // Find root ancestors (Generation 1 or members with no parents in the tree)
  const rootMembers = members.filter((m) => {
    const parents = childToParents.get(m.id);
    return (!parents || parents.length === 0) && (m.generation === 1 || !m.generation);
  });

  // If root members exist, assign root branch
  const primaryRoot = rootMembers.find((m) => m.gender === 'MALE') || rootMembers[0] || members[0];
  const rootBranchName = primaryRoot ? makeBranchName(primaryRoot) : 'Main Family Branch';

  rootMembers.forEach((rm) => {
    branchAssignments.set(rm.id, rootBranchName);
    const spouseId = spouseOf.get(rm.id);
    if (spouseId) {
      branchAssignments.set(spouseId, rootBranchName);
    }
  });

  // Married couples where at least one partner is a child (has parents or generation >= 2) or has children
  const processedCouples = new Set<string>();

  members.forEach((m) => {
    const spouseId = spouseOf.get(m.id);
    if (!spouseId) return;

    const coupleKey = [m.id, spouseId].sort().join('::');
    if (processedCouples.has(coupleKey)) return;
    processedCouples.add(coupleKey);

    const spouseMember = memberMap.get(spouseId);
    if (!spouseMember) return;

    const mParents = childToParents.get(m.id) || [];
    const spouseParents = childToParents.get(spouseId) || [];
    const mChildren = parentToChildren.get(m.id) || [];
    const spouseChildren = parentToChildren.get(spouseId) || [];

    const hasChildren = mChildren.length > 0 || spouseChildren.length > 0;
    const isChildCouple =
      mParents.length > 0 ||
      spouseParents.length > 0 ||
      (m.generation && m.generation >= 2) ||
      (spouseMember.generation && spouseMember.generation >= 2) ||
      hasChildren;

    if (isChildCouple) {
      // Lineage member is the one with parents in tree or higher generation / has custom branch / primary parent
      let lineageChild = m;
      let incomingSpouse = spouseMember;
      if (spouseParents.length > 0 && mParents.length === 0) {
        lineageChild = spouseMember;
        incomingSpouse = m;
      } else if (spouseParents.length === mParents.length) {
        if (spouseMember.branchName && !m.branchName) {
          lineageChild = spouseMember;
          incomingSpouse = m;
        }
      }

      // Dedicated branch named after that member (e.g., [Member Name]'s Family Branch)
      const coupleBranchName = makeBranchName(lineageChild);

      branchAssignments.set(lineageChild.id, coupleBranchName);
      branchAssignments.set(incomingSpouse.id, coupleBranchName);

      // Direct children of this couple inherit this branch unless they have their own spouse branch
      const queue = [
        ...(parentToChildren.get(lineageChild.id) || []),
        ...(parentToChildren.get(incomingSpouse.id) || []),
      ];
      const visitedChildren = new Set<string>();

      while (queue.length > 0) {
        const childId = queue.shift()!;
        if (visitedChildren.has(childId)) continue;
        visitedChildren.add(childId);

        // If this child does NOT have their own spouse, assign parents' branch
        if (!spouseOf.has(childId)) {
          const childMember = memberMap.get(childId);
          if (
            childMember?.branchName &&
            childMember.branchName.trim() &&
            childMember.branchName.toLowerCase() !== 'root lineage' &&
            childMember.branchName.toLowerCase() !== 'rootlineage'
          ) {
            branchAssignments.set(childId, childMember.branchName.trim());
          } else {
            branchAssignments.set(childId, coupleBranchName);
          }
          const grandchildren = parentToChildren.get(childId) || [];
          queue.push(...grandchildren);
        }
      }
    }
  });

  // Ensure every single member has a branch
  members.forEach((m) => {
    if (!branchAssignments.has(m.id)) {
      if (
        m.branchName &&
        m.branchName.trim() &&
        m.branchName.toLowerCase() !== 'root lineage' &&
        m.branchName.toLowerCase() !== 'rootlineage'
      ) {
        branchAssignments.set(m.id, m.branchName.trim());
      } else {
        const parents = childToParents.get(m.id) || [];
        const parentBranch = parents.map((pId) => branchAssignments.get(pId)).find(Boolean);
        if (parentBranch) {
          branchAssignments.set(m.id, parentBranch);
        } else {
          branchAssignments.set(m.id, makeBranchName(m));
        }
      }
    }
  });

  // Map updated members with resolved branchName and branchId
  return members.map((m) => {
    const resolvedBranch = branchAssignments.get(m.id) || makeBranchName(m);
    const branchSlug = `branch-${resolvedBranch.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
    return {
      ...m,
      branchName: resolvedBranch,
      branchId: m.branchId || branchSlug,
    };
  });
}
