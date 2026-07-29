export default function EmployeeBranchPicker({ branches, selectedIds, onToggle }) {
  const selectedBranches = branches.filter((branch) => selectedIds.includes(branch.branch_uuid || branch.id));
  const summary = selectedBranches.length === 0
    ? "Chọn chi nhánh làm việc"
    : selectedBranches.length === 1
      ? selectedBranches[0].name
      : `Đã chọn ${selectedBranches.length} chi nhánh`;

  return (
    <label className="employee-branch-field">
      <span>Chi nhánh làm việc <b className="employee-required-mark" aria-label="bắt buộc">*</b></span>
      <details className="employee-branch-picker">
        <summary>{summary}<span aria-hidden="true">⌄</span></summary>
        <div className="employee-branch-options">
          {branches.map((branch) => {
            const id = branch.branch_uuid || branch.id;
            return (
              <label key={id}>
                <input type="checkbox" checked={selectedIds.includes(id)} onChange={() => onToggle(id)} />
                <span><strong>{branch.name}</strong><small>{branch.address || branch.code || ""}</small></span>
              </label>
            );
          })}
        </div>
      </details>
      {selectedBranches.length > 1 ? <small className="employee-selected-branches">{selectedBranches.map((branch) => branch.name).join(" · ")}</small> : null}
    </label>
  );
}
