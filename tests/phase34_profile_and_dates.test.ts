import { describe, it, expect } from 'vitest';
import {
  formatSingleDate,
  getNodeDateRows,
  formatMemberDates,
} from '../src/components/genealogy/HeritageMemberNode.tsx';
import { calculateTreeLayout } from '../src/utils/treeLayout.ts';
import { FamilyMember, Relationship } from '../src/types/index.ts';

describe('Phase 34: Family Tree Profile, Date Display & Selection Behavior', () => {
  describe('Strict Date Display & Mutual Exclusivity', () => {
    it('Combination A: Living person with DOB only -> displays DOB, no DOM, no DOD', () => {
      const livingMember = {
        id: 'm1',
        firstName: 'Aarav',
        lastName: 'Sharma',
        dateOfBirth: '1984-09-30',
        dateOfDeath: null,
        isLiving: true,
      };

      const rows = getNodeDateRows(livingMember);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({ label: 'DOB', text: 'DOB: 30 Sep 1984' });

      // Ensure no DOM, DOD, or Present
      expect(rows.some((r) => r.label === 'DOM')).toBe(false);
      expect(rows.some((r) => r.label === 'DOD')).toBe(false);
      expect(rows.some((r) => r.text.includes('Present'))).toBe(false);
    });

    it('Combination B: Living person with DOB and DOM -> row 1 DOB, row 2 DOM, no DOD, never Present', () => {
      const marriedLivingMember = {
        id: 'm2',
        firstName: 'Priya',
        lastName: 'Sharma',
        dateOfBirth: '1984-09-30',
        dateOfMarriage: '2010-06-12',
        dateOfDeath: null,
        isLiving: true,
      };

      const rows = getNodeDateRows(marriedLivingMember);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ label: 'DOB', text: 'DOB: 30 Sep 1984' });
      expect(rows[1]).toEqual({ label: 'DOM', text: 'DOM: 12 Jun 2010' });

      // Strict row order and values
      expect(rows[0].label).toBe('DOB');
      expect(rows[1].label).toBe('DOM');
      expect(rows.some((r) => r.label === 'DOD')).toBe(false);
      expect(rows.some((r) => r.text.includes('Present'))).toBe(false);
    });

    it('Combination B (override): Marriage date passed via override parameter works for living member', () => {
      const livingMember = {
        id: 'm2b',
        firstName: 'Priya',
        lastName: 'Sharma',
        dateOfBirth: '1984-09-30',
        isLiving: true,
      };

      const rows = getNodeDateRows(livingMember, '2010-06-12');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ label: 'DOB', text: 'DOB: 30 Sep 1984' });
      expect(rows[1]).toEqual({ label: 'DOM', text: 'DOM: 12 Jun 2010' });
    });

    it('Combination C: Deceased person with DOB, DOM, and DOD -> row 1 DOB, row 2 DOM, row 3 DOD in exact order', () => {
      const deceasedMember = {
        id: 'm3',
        firstName: 'Ram',
        lastName: 'Sharma',
        dateOfBirth: '1925-08-15',
        dateOfDeath: '2005-02-18',
        dateOfMarriage: '1950-06-12', // DOM is ALWAYS preserved even if deceased
        isLiving: false,
      };

      const rows = getNodeDateRows(deceasedMember, '1950-06-12');
      expect(rows).toHaveLength(3);
      expect(rows[0]).toEqual({ label: 'DOB', text: 'DOB: 15 Aug 1925' });
      expect(rows[1]).toEqual({ label: 'DOM', text: 'DOM: 12 Jun 1950' });
      expect(rows[2]).toEqual({ label: 'DOD', text: 'DOD: 18 Feb 2005' });
      expect(rows.some((r) => r.text.includes('Present'))).toBe(false);
    });

    it('Combination D: Deceased person with DOB and DOM (no DOD) -> displays DOB then DOM', () => {
      const deceasedWithoutDod = {
        id: 'm4',
        firstName: 'Lakshmi',
        lastName: 'Sharma',
        dateOfBirth: '1984-09-30',
        dateOfDeath: null,
        dateOfMarriage: '2005-01-10',
        isLiving: false, // marked deceased
      };

      const rows = getNodeDateRows(deceasedWithoutDod, '2005-01-10');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ label: 'DOB', text: 'DOB: 30 Sep 1984' });
      expect(rows[1]).toEqual({ label: 'DOM', text: 'DOM: 10 Jan 2005' });

      // Must not invent a date
      expect(rows.some((r) => r.label === 'DOD')).toBe(false);
      expect(rows.some((r) => r.text.includes('Present'))).toBe(false);
    });

    it('Combination E: Deceased person with DOM and DOD -> displays DOM then DOD in order', () => {
      const deceasedDodAndDom = {
        id: 'm5',
        firstName: 'Anand',
        lastName: 'Sharma',
        dateOfBirth: null,
        dateOfDeath: '2005-02-18',
        dateOfMarriage: '1950-06-12',
        isLiving: false,
      };

      const rows = getNodeDateRows(deceasedDodAndDom);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ label: 'DOM', text: 'DOM: 12 Jun 1950' });
      expect(rows[1]).toEqual({ label: 'DOD', text: 'DOD: 18 Feb 2005' });
      expect(rows.some((r) => r.label === 'DOB')).toBe(false);
      expect(rows.some((r) => r.text.includes('Present'))).toBe(false);

      // And when truly DOD only (no marriage date)
      const deceasedDodOnly = {
        id: 'm5b',
        firstName: 'Anand',
        lastName: 'Sharma',
        dateOfBirth: null,
        dateOfDeath: '2005-02-18',
        dateOfMarriage: null,
        isLiving: false,
      };
      const rowsDodOnly = getNodeDateRows(deceasedDodOnly);
      expect(rowsDodOnly).toHaveLength(1);
      expect(rowsDodOnly[0]).toEqual({ label: 'DOD', text: 'DOD: 18 Feb 2005' });
    });

    it('Combination F: Missing dates -> omits rows cleanly, never invents, never crashes', () => {
      const noDatesMember = {
        id: 'm6',
        firstName: 'Sita',
        lastName: 'Sharma',
        dateOfBirth: null,
        dateOfDeath: null,
        isLiving: true,
      };

      const rows = getNodeDateRows(noDatesMember);
      expect(rows).toEqual([]);
      expect(rows).toHaveLength(0);
    });

    it('formatSingleDate: formats DD Mon YYYY human-readable dates and rejects invalid / present placeholders', () => {
      expect(formatSingleDate('1925-08-15')).toBe('15 Aug 1925');
      expect(formatSingleDate('2010-06-12')).toBe('12 Jun 2010');
      expect(formatSingleDate('2005-02-18')).toBe('18 Feb 2005');
      expect(formatSingleDate('1984-09-30T00:00:00.000Z')).toBe('30 Sep 1984');

      // Rejects "Present" and other bad data
      expect(formatSingleDate('Present')).toBeNull();
      expect(formatSingleDate('present')).toBeNull();
      expect(formatSingleDate('Rest in peace')).toBeNull();
      expect(formatSingleDate('—')).toBeNull();
      expect(formatSingleDate('unknown')).toBeNull();
      expect(formatSingleDate(null)).toBeNull();
      expect(formatSingleDate(undefined)).toBeNull();
      expect(formatSingleDate('')).toBeNull();
    });

    it('formatMemberDates: respects living vs deceased DOM/DOD mutual exclusivity', () => {
      // Living person with marriage
      const living = formatMemberDates('1984-09-30', null, true, '2010-06-12');
      expect(living.dob).toBe('30 Sep 1984');
      expect(living.dom).toBe('12 Jun 2010');
      expect(living.dod).toBeNull();

      // Deceased person with marriage - DOM MUST be null
      const deceased = formatMemberDates('1925-08-15', '2005-02-18', false, '1950-06-12');
      expect(deceased.dob).toBe('15 Aug 1925');
      expect(deceased.dom).toBeNull(); // Deceased never displays DOM
      expect(deceased.dod).toBe('18 Feb 2005');
    });
  });

  describe('Tree Selection State & Neutral Initial State', () => {
    const mockMembers: FamilyMember[] = [
      {
        id: 'mem-1',
        familyId: 'fam-1',
        firstName: 'Matriarch Lakshmi',
        lastName: 'Pattara',
        gender: 'FEMALE',
        isLiving: false,
        dateOfBirth: '1925-08-15',
        dateOfDeath: '2005-02-18',
        generation: 1,
        memoryCount: 0,
      },
      {
        id: 'mem-2',
        familyId: 'fam-1',
        firstName: 'Patriarch Ram',
        lastName: 'Pattara',
        gender: 'MALE',
        isLiving: false,
        dateOfBirth: '1920-05-10',
        dateOfDeath: '1998-11-20',
        generation: 1,
        memoryCount: 0,
      },
    ];

    const mockRelationships: Relationship[] = [
      {
        id: 'rel-1',
        familyId: 'fam-1',
        sourceMemberId: 'mem-2',
        targetMemberId: 'mem-1',
        relationshipType: 'SPOUSE',
        marriageDate: '1945-02-14',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    it('Tree layout calculation without selected member defaults to neutral unselected state', () => {
      const layout = calculateTreeLayout(mockMembers, mockRelationships, {
        selectedMemberId: undefined,
        focusedNodeIds: null,
      });

      expect(layout.nodes.length).toBeGreaterThan(0);
      const memberNodes = layout.nodes.filter((n) => n.type === 'heritageMember');
      expect(memberNodes.length).toBe(2);

      // Verify NO nodes have isSelected = true
      memberNodes.forEach((n) => {
        expect(n.data.isSelected).toBe(false);
        expect(n.data.isFocused).toBe(false);
        expect(n.data.isDimmed).toBe(false);
      });
    });

    it('Tree layout passes accurate date data to member nodes and formats DOB, DOM, and DOD', () => {
      const layout = calculateTreeLayout(mockMembers, mockRelationships, {});
      const memberNodes = layout.nodes.filter((n) => n.type === 'heritageMember');

      memberNodes.forEach((n) => {
        const rows = getNodeDateRows(n.data.member, n.data.marriageDate);
        expect(rows.some((r) => r.text.includes('Present'))).toBe(false);
      });
    });

    it('Case C: Married male + married female + DOM -> Both nodes & profiles show DOB + DOM', () => {
      const livingSpouseA: FamilyMember = {
        id: 'spouse-ravi',
        familyId: 'fam-1',
        firstName: 'Ravi',
        lastName: 'Sharma',
        gender: 'MALE',
        isLiving: true,
        dateOfBirth: '1981-05-19',
        generation: 2,
        memoryCount: 0,
      };
      const livingSpouseB: FamilyMember = {
        id: 'spouse-rani',
        familyId: 'fam-1',
        firstName: 'Rani',
        lastName: 'Sharma',
        gender: 'FEMALE',
        isLiving: true,
        dateOfBirth: '1999-02-02',
        generation: 2,
        memoryCount: 0,
      };
      const marriageRel: Relationship = {
        id: 'rel-m1',
        familyId: 'fam-1',
        sourceMemberId: 'spouse-ravi',
        targetMemberId: 'spouse-rani',
        relationshipType: 'SPOUSE',
        marriageDate: '2010-01-10',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000Z',
      };

      const layout = calculateTreeLayout([livingSpouseA, livingSpouseB], [marriageRel], {});
      const nodeA = layout.nodes.find((n) => n.id === 'spouse-ravi')!;
      const nodeB = layout.nodes.find((n) => n.id === 'spouse-rani')!;

      // Both nodes must have marriageDate mapped independently
      expect(nodeA.data.marriageDate).toBe('2010-01-10');
      expect(nodeB.data.marriageDate).toBe('2010-01-10');

      const rowsA = getNodeDateRows(nodeA.data.member, nodeA.data.marriageDate);
      const rowsB = getNodeDateRows(nodeB.data.member, nodeB.data.marriageDate);

      // Ravi node
      expect(rowsA).toEqual([
        { label: 'DOB', text: 'DOB: 19 May 1981' },
        { label: 'DOM', text: 'DOM: 10 Jan 2010' },
      ]);

      // Rani node
      expect(rowsB).toEqual([
        { label: 'DOB', text: 'DOB: 2 Feb 1999' },
        { label: 'DOM', text: 'DOM: 10 Jan 2010' },
      ]);
    });

    it('Case E: Deceased + DOB + DOM + DOD -> displays all 3 in order DOB, DOM, DOD', () => {
      const deceasedPerson = {
        id: 'mem-e',
        firstName: 'Dev',
        lastName: 'Sharma',
        gender: 'MALE' as const,
        isLiving: false,
        dateOfBirth: '1930-03-25',
        dateOfDeath: '2015-08-10',
        dateOfMarriage: '1955-06-20',
        marriageDate: '1955-06-20',
      };

      const rows = getNodeDateRows(deceasedPerson, '1955-06-20');
      expect(rows).toEqual([
        { label: 'DOB', text: 'DOB: 25 Mar 1930' },
        { label: 'DOM', text: 'DOM: 20 Jun 1955' },
        { label: 'DOD', text: 'DOD: 10 Aug 2015' },
      ]);
    });

    it('Case G & H: Marriage date added after spouse creation or edited -> Both spouse nodes update', () => {
      const spouse1: FamilyMember = {
        id: 's1',
        familyId: 'fam-1',
        firstName: 'Arjun',
        lastName: 'Kapoor',
        gender: 'MALE',
        isLiving: true,
        dateOfBirth: '1985-04-12',
        generation: 1,
        memoryCount: 0,
      };
      const spouse2: FamilyMember = {
        id: 's2',
        familyId: 'fam-1',
        firstName: 'Meera',
        lastName: 'Kapoor',
        gender: 'FEMALE',
        isLiving: true,
        dateOfBirth: '1988-11-23',
        generation: 1,
        memoryCount: 0,
      };

      // 1. Created initially without marriage date
      const initialRel: Relationship = {
        id: 'rel-initial',
        familyId: 'fam-1',
        sourceMemberId: 's1',
        targetMemberId: 's2',
        relationshipType: 'SPOUSE',
        marriageDate: null,
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      const initialLayout = calculateTreeLayout([spouse1, spouse2], [initialRel], {});
      const initNode1 = initialLayout.nodes.find((n) => n.id === 's1')!;
      const initNode2 = initialLayout.nodes.find((n) => n.id === 's2')!;
      expect(getNodeDateRows(initNode1.data.member, initNode1.data.marriageDate)).toEqual([
        { label: 'DOB', text: 'DOB: 12 Apr 1985' },
      ]);
      expect(getNodeDateRows(initNode2.data.member, initNode2.data.marriageDate)).toEqual([
        { label: 'DOB', text: 'DOB: 23 Nov 1988' },
      ]);

      // 2. Marriage date added / edited later
      const updatedRel: Relationship = {
        ...initialRel,
        marriageDate: '2012-05-18',
      };
      const updatedLayout = calculateTreeLayout([spouse1, spouse2], [updatedRel], {});
      const upNode1 = updatedLayout.nodes.find((n) => n.id === 's1')!;
      const upNode2 = updatedLayout.nodes.find((n) => n.id === 's2')!;
      expect(getNodeDateRows(upNode1.data.member, upNode1.data.marriageDate)).toEqual([
        { label: 'DOB', text: 'DOB: 12 Apr 1985' },
        { label: 'DOM', text: 'DOM: 18 May 2012' },
      ]);
      expect(getNodeDateRows(upNode2.data.member, upNode2.data.marriageDate)).toEqual([
        { label: 'DOB', text: 'DOB: 23 Nov 1988' },
        { label: 'DOM', text: 'DOM: 18 May 2012' },
      ]);

      // 3. Marriage date removed
      const removedRel: Relationship = {
        ...initialRel,
        marriageDate: null,
      };
      const removedLayout = calculateTreeLayout([spouse1, spouse2], [removedRel], {});
      const remNode1 = removedLayout.nodes.find((n) => n.id === 's1')!;
      const remNode2 = removedLayout.nodes.find((n) => n.id === 's2')!;
      expect(getNodeDateRows(remNode1.data.member, remNode1.data.marriageDate)).toEqual([
        { label: 'DOB', text: 'DOB: 12 Apr 1985' },
      ]);
      expect(getNodeDateRows(remNode2.data.member, remNode2.data.marriageDate)).toEqual([
        { label: 'DOB', text: 'DOB: 23 Nov 1988' },
      ]);
    });

    describe('Verification of Exact Cases A through J', () => {
      it('Case A: Living + DOB only -> DOB only', () => {
        const member = {
          firstName: 'Ravi',
          lastName: 'Sharma',
          dateOfBirth: '1981-05-19',
          isLiving: true,
        };
        const rows = getNodeDateRows(member);
        expect(rows).toEqual([{ label: 'DOB', text: 'DOB: 19 May 1981' }]);
      });

      it('Case B: Living + DOB + DOM -> DOB, DOM', () => {
        const member = {
          firstName: 'Ravi',
          lastName: 'Sharma',
          dateOfBirth: '1981-05-19',
          dateOfMarriage: '2010-06-12',
          isLiving: true,
        };
        const rows = getNodeDateRows(member);
        expect(rows).toEqual([
          { label: 'DOB', text: 'DOB: 19 May 1981' },
          { label: 'DOM', text: 'DOM: 12 Jun 2010' },
        ]);
        expect(rows[1].label).toBe('DOM');
      });

      it('Case C: Married male + married female + DOM -> Both nodes & profiles show DOB + DOM', () => {
        const husband: FamilyMember = {
          id: 'h1',
          familyId: 'fam-c',
          firstName: 'Ravi',
          lastName: 'Sharma',
          gender: 'MALE',
          isLiving: true,
          dateOfBirth: '1981-05-19',
          generation: 1,
          memoryCount: 0,
        };
        const wife: FamilyMember = {
          id: 'w1',
          familyId: 'fam-c',
          firstName: 'Rani',
          lastName: 'Sharma',
          gender: 'FEMALE',
          isLiving: true,
          dateOfBirth: '1999-02-02',
          generation: 1,
          memoryCount: 0,
        };
        const spouseRelationship: Relationship = {
          id: 'rel-hw',
          familyId: 'fam-c',
          sourceMemberId: 'h1',
          targetMemberId: 'w1',
          relationshipType: 'SPOUSE',
          marriageDate: '2010-01-10',
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00.000Z',
        };

        const tree = calculateTreeLayout([husband, wife], [spouseRelationship], {});
        const hNode = tree.nodes.find((n) => n.id === 'h1')!;
        const wNode = tree.nodes.find((n) => n.id === 'w1')!;

        // Both nodes
        expect(getNodeDateRows(hNode.data.member, hNode.data.marriageDate)).toEqual([
          { label: 'DOB', text: 'DOB: 19 May 1981' },
          { label: 'DOM', text: 'DOM: 10 Jan 2010' },
        ]);
        expect(getNodeDateRows(wNode.data.member, wNode.data.marriageDate)).toEqual([
          { label: 'DOB', text: 'DOB: 2 Feb 1999' },
          { label: 'DOM', text: 'DOM: 10 Jan 2010' },
        ]);

        // Both profiles (using shared helper)
        expect(getNodeDateRows(husband, spouseRelationship.marriageDate)).toEqual([
          { label: 'DOB', text: 'DOB: 19 May 1981' },
          { label: 'DOM', text: 'DOM: 10 Jan 2010' },
        ]);
        expect(getNodeDateRows(wife, spouseRelationship.marriageDate)).toEqual([
          { label: 'DOB', text: 'DOB: 2 Feb 1999' },
          { label: 'DOM', text: 'DOM: 10 Jan 2010' },
        ]);
      });

      it('Case D: Deceased + DOB + DOD -> DOB, DOD', () => {
        const deceased = {
          firstName: 'Dev',
          lastName: 'Sharma',
          dateOfBirth: '1925-08-15',
          dateOfDeath: '2005-02-18',
          isLiving: false,
        };
        const rows = getNodeDateRows(deceased);
        expect(rows).toEqual([
          { label: 'DOB', text: 'DOB: 15 Aug 1925' },
          { label: 'DOD', text: 'DOD: 18 Feb 2005' },
        ]);
      });

      it('Case E: Deceased + DOB + DOM + DOD -> DOB, DOM, DOD in exact order', () => {
        const deceasedWithDom = {
          firstName: 'Dev',
          lastName: 'Sharma',
          dateOfBirth: '1925-08-15',
          dateOfDeath: '2005-02-18',
          dateOfMarriage: '1950-06-12',
          isLiving: false,
        };
        const rows = getNodeDateRows(deceasedWithDom, '1950-06-12');
        expect(rows).toEqual([
          { label: 'DOB', text: 'DOB: 15 Aug 1925' },
          { label: 'DOM', text: 'DOM: 12 Jun 1950' },
          { label: 'DOD', text: 'DOD: 18 Feb 2005' },
        ]);
      });

      it('Case F: Deceased + DOB without DOD -> DOB then DOM', () => {
        const deceasedNoDod = {
          firstName: 'Dev',
          lastName: 'Sharma',
          dateOfBirth: '1925-08-15',
          dateOfDeath: null,
          dateOfMarriage: '1950-06-12',
          isLiving: false,
        };
        const rows = getNodeDateRows(deceasedNoDod, '1950-06-12');
        expect(rows).toEqual([
          { label: 'DOB', text: 'DOB: 15 Aug 1925' },
          { label: 'DOM', text: 'DOM: 12 Jun 1950' },
        ]);
        expect(rows.some((r) => r.label === 'DOD')).toBe(false);
      });

      it('Case G: Marriage date added after spouse creation -> Both spouse nodes update', () => {
        const m1: FamilyMember = {
          id: 'sp1',
          familyId: 'f1',
          firstName: 'Arun',
          lastName: 'Verma',
          gender: 'MALE',
          isLiving: true,
          dateOfBirth: '1980-04-10',
          generation: 1,
          memoryCount: 0,
        };
        const m2: FamilyMember = {
          id: 'sp2',
          familyId: 'f1',
          firstName: 'Geeta',
          lastName: 'Verma',
          gender: 'FEMALE',
          isLiving: true,
          dateOfBirth: '1983-09-15',
          generation: 1,
          memoryCount: 0,
        };
        const initialRel: Relationship = {
          id: 'rel-g',
          familyId: 'f1',
          sourceMemberId: 'sp1',
          targetMemberId: 'sp2',
          relationshipType: 'SPOUSE',
          marriageDate: null,
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00.000Z',
        };

        const treeBefore = calculateTreeLayout([m1, m2], [initialRel], {});
        expect(treeBefore.nodes.find((n) => n.id === 'sp1')!.data.marriageDate).toBeNull();
        expect(treeBefore.nodes.find((n) => n.id === 'sp2')!.data.marriageDate).toBeNull();

        const updatedRel: Relationship = {
          ...initialRel,
          marriageDate: '2008-11-20',
        };
        const treeAfter = calculateTreeLayout([m1, m2], [updatedRel], {});
        const n1 = treeAfter.nodes.find((n) => n.id === 'sp1')!;
        const n2 = treeAfter.nodes.find((n) => n.id === 'sp2')!;

        expect(getNodeDateRows(n1.data.member, n1.data.marriageDate)).toEqual([
          { label: 'DOB', text: 'DOB: 10 Apr 1980' },
          { label: 'DOM', text: 'DOM: 20 Nov 2008' },
        ]);
        expect(getNodeDateRows(n2.data.member, n2.data.marriageDate)).toEqual([
          { label: 'DOB', text: 'DOB: 15 Sep 1983' },
          { label: 'DOM', text: 'DOM: 20 Nov 2008' },
        ]);
      });

      it('Case H: Marriage date edited -> Both spouse nodes/profiles update', () => {
        const m1: FamilyMember = {
          id: 'sp1',
          familyId: 'f1',
          firstName: 'Arun',
          lastName: 'Verma',
          gender: 'MALE',
          isLiving: true,
          dateOfBirth: '1980-04-10',
          generation: 1,
          memoryCount: 0,
        };
        const m2: FamilyMember = {
          id: 'sp2',
          familyId: 'f1',
          firstName: 'Geeta',
          lastName: 'Verma',
          gender: 'FEMALE',
          isLiving: true,
          dateOfBirth: '1983-09-15',
          generation: 1,
          memoryCount: 0,
        };
        const originalRel: Relationship = {
          id: 'rel-h',
          familyId: 'f1',
          sourceMemberId: 'sp1',
          targetMemberId: 'sp2',
          relationshipType: 'SPOUSE',
          marriageDate: '2008-11-20',
          status: 'ACTIVE',
          createdAt: '2026-01-01T00:00:00.000Z',
        };

        const editedRel: Relationship = {
          ...originalRel,
          marriageDate: '2015-02-14',
        };
        const treeEdited = calculateTreeLayout([m1, m2], [editedRel], {});
        const n1 = treeEdited.nodes.find((n) => n.id === 'sp1')!;
        const n2 = treeEdited.nodes.find((n) => n.id === 'sp2')!;

        expect(getNodeDateRows(n1.data.member, n1.data.marriageDate)).toEqual([
          { label: 'DOB', text: 'DOB: 10 Apr 1980' },
          { label: 'DOM', text: 'DOM: 14 Feb 2015' },
        ]);
        expect(getNodeDateRows(n2.data.member, n2.data.marriageDate)).toEqual([
          { label: 'DOB', text: 'DOB: 15 Sep 1983' },
          { label: 'DOM', text: 'DOM: 14 Feb 2015' },
        ]);
      });

      it('Case I: Page refresh simulation -> DOM/DOD values remain correct', () => {
        // Raw MongoDB response structure
        const dbRelationships: Relationship[] = [
          {
            id: 'rel-refresh',
            familyId: 'fam-refresh',
            sourceMemberId: 'user-1',
            targetMemberId: 'user-2',
            relationshipType: 'SPOUSE',
            status: 'ACTIVE',
            marriageDate: '2010-01-10',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ];

        const dbMembers: FamilyMember[] = [
          {
            id: 'user-1',
            familyId: 'fam-refresh',
            firstName: 'Ravi',
            lastName: 'Sharma',
            gender: 'MALE',
            isLiving: true,
            dateOfBirth: '1981-05-19',
            generation: 1,
            memoryCount: 0,
          },
          {
            id: 'user-2',
            familyId: 'fam-refresh',
            firstName: 'Rani',
            lastName: 'Sharma',
            gender: 'FEMALE',
            isLiving: false, // Rani is deceased
            dateOfBirth: '1950-02-02',
            dateOfDeath: '2020-03-15',
            generation: 1,
            memoryCount: 0,
          },
        ];

        const tree = calculateTreeLayout(dbMembers, dbRelationships, {});
        const r1 = tree.nodes.find((n) => n.id === 'user-1')!;
        const r2 = tree.nodes.find((n) => n.id === 'user-2')!;

        // Living spouse shows DOB and DOM
        expect(getNodeDateRows(r1.data.member, r1.data.marriageDate)).toEqual([
          { label: 'DOB', text: 'DOB: 19 May 1981' },
          { label: 'DOM', text: 'DOM: 10 Jan 2010' },
        ]);

        // Deceased spouse with DOM shows DOB, DOM, and DOD
        expect(getNodeDateRows(r2.data.member, r2.data.marriageDate)).toEqual([
          { label: 'DOB', text: 'DOB: 2 Feb 1950' },
          { label: 'DOM', text: 'DOM: 10 Jan 2010' },
          { label: 'DOD', text: 'DOD: 15 Mar 2020' },
        ]);
      });

      it('Case J: Missing date -> No empty date row and no fabricated value', () => {
        const personNoDates = {
          firstName: 'Kiran',
          lastName: 'Patel',
          dateOfBirth: null,
          dateOfDeath: null,
          isLiving: true,
        };
        const rows = getNodeDateRows(personNoDates);
        expect(rows).toEqual([]);
        expect(rows.length).toBe(0);
      });
    });
  });
});
