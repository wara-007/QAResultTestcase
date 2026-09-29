export type ProjectAccessCapabilities = {
  canView: boolean;
  canEdit: boolean;
  canManage: boolean;
  canDelete: boolean;
};

export type ProjectAccessRow = {
  can_view?: boolean | null;
  can_edit?: boolean | null;
  can_manage?: boolean | null;
  can_delete?: boolean | null;
};

export function projectCapabilitiesFromRow(row: ProjectAccessRow): ProjectAccessCapabilities {
  return {
    canView: row.can_view === true,
    canEdit: row.can_edit === true,
    canManage: row.can_manage === true,
    canDelete: row.can_delete === true,
  };
}
