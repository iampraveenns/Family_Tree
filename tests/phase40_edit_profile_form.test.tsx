import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AddMemberModal } from '../src/components/genealogy/AddMemberModal.tsx';
import { FamilyMember } from '../src/types/index.ts';

describe('Phase 40: FamilyRoots — Edit Profile Form Layout & Field Presentation', () => {
  const memberToEdit: FamilyMember = {
    id: 'mem-edit-1',
    familyId: 'fam-edit-test',
    firstName: 'Ravi',
    lastName: 'Pattara',
    displayName: 'Ravi Pattara',
    gender: 'MALE',
    isLiving: true,
    dateOfBirth: '1981-05-19',
    dateOfMarriage: '2026-10-02',
    dateOfDeath: null,
    occupation: 'Architectural Photographer',
    birthPlace: 'Bengaluru, Karnataka',
    generation: 1,
    branchName: 'Ravi Branch',
    branchId: 'branch-ravi',
    profilePhoto: '',
    biography: 'Master of architectural captures',
    createdAt: '2026-01-01T00:00:00.000Z',
    memoryCount: 2,
  };

  it('1. Profile Photo Upload section is at the top with direct upload elements', () => {
    const html = renderToString(
      <AddMemberModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={async () => {}}
        isRootAncestor={false}
        editMember={memberToEdit}
      />
    );

    // Profile photo upload button and helper text
    expect(html).toContain('Upload Profile Photo');
    expect(html).toContain('Click to upload or drag and drop');
    expect(html).toContain('JPG, PNG • Max 5MB');
  });

  it('2. Branch Assignment is completely removed from the Edit Profile form', () => {
    const html = renderToString(
      <AddMemberModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={async () => {}}
        isRootAncestor={false}
        editMember={memberToEdit}
      />
    );

    // Branch Assignment must NOT be present anywhere in the edit form
    expect(html).not.toContain('Branch Assignment');
    expect(html).not.toContain('Inherit Reference Branch');
  });

  it('3. Photo URL input is completely removed from the form', () => {
    const html = renderToString(
      <AddMemberModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={async () => {}}
        isRootAncestor={false}
        editMember={memberToEdit}
      />
    );

    // Photo URL must NOT be present
    expect(html).not.toContain('Photo URL');
    expect(html).not.toContain('Photo URL (Direct Image URL)');
  });

  it('4. First Name and Last Name are present in the form', () => {
    const html = renderToString(
      <AddMemberModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={async () => {}}
        isRootAncestor={false}
        editMember={memberToEdit}
      />
    );

    expect(html).toContain('First Name');
    expect(html).toContain('Last Name');
    expect(html).toContain('value="Ravi"');
    expect(html).toContain('value="Pattara"');
  });

  it('5. Gender is a normal dropdown/select and NOT radio buttons, sharing row with Occupation', () => {
    const html = renderToString(
      <AddMemberModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={async () => {}}
        isRootAncestor={false}
        editMember={memberToEdit}
      />
    );

    // Gender dropdown
    expect(html).toContain('Gender');
    expect(html).toContain('<select');
    expect(html).toContain('value="MALE"');
    expect(html).toContain('Male');
    expect(html).toContain('Female');

    // Occupation
    expect(html).toContain('Occupation (Optional)');
    expect(html).toContain('value="Architectural Photographer"');

    // Gender must NOT use radio buttons
    expect(html).not.toContain('name="gender"');
  });

  it('6. Date of Birth and Marriage Date (DOM) are in the form', () => {
    const html = renderToString(
      <AddMemberModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={async () => {}}
        isRootAncestor={false}
        editMember={memberToEdit}
      />
    );

    expect(html).toContain('Date of Birth');
    expect(html).toContain('Marriage Date (DOM)');
    expect(html).toContain('value="1981-05-19"');
    expect(html).toContain('value="2026-10-02"');
  });

  it('7. Birthplace appears below dates as full-width field', () => {
    const html = renderToString(
      <AddMemberModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={async () => {}}
        isRootAncestor={false}
        editMember={memberToEdit}
      />
    );

    expect(html).toContain('Birthplace (Optional)');
    expect(html).toContain('value="Bengaluru, Karnataka"');
  });

  it('8. Status radio buttons and Death Date (DOD) are NOT in the Edit Profile form', () => {
    const html = renderToString(
      <AddMemberModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={async () => {}}
        isRootAncestor={false}
        editMember={memberToEdit}
      />
    );

    // Status is exclusively handled by Edit Life Status modal
    expect(html).not.toContain('name="isLiving"');
    expect(html).not.toContain('Death Date');
    expect(html).not.toContain('Death Date (DOD)');
  });

  it('9. Additional Details section is present and contains Biography and Notes only', () => {
    const html = renderToString(
      <AddMemberModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={async () => {}}
        isRootAncestor={false}
        editMember={memberToEdit}
      />
    );

    expect(html).toContain('Additional Details');
    expect(html).toContain('Biography');
    expect(html).toContain('Notes');
  });

  it('10. Action buttons Cancel and Save Profile Changes are present', () => {
    const html = renderToString(
      <AddMemberModal
        isOpen={true}
        onClose={() => {}}
        onSubmit={async () => {}}
        isRootAncestor={false}
        editMember={memberToEdit}
      />
    );

    expect(html).toContain('Cancel');
    expect(html).toContain('Save Profile Changes');
  });
});
