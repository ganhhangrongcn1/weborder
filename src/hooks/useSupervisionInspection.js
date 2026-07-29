import { useCallback, useEffect, useState } from "react";
import { deleteInspectionEvidence, loadInspection, loadInspectionSetup, saveInspectionAnswer, saveInspectionConfirmation, startInspection, submitInspection, uploadInspectionEvidence, uploadInspectionSignature } from "../services/supervisionInspectionService.js";

export default function useSupervisionInspection() {
  const [state, setState] = useState({ setup: null, inspection: null, loading: true, working: false, error: "", result: null });

  useEffect(() => {
    let active = true;
    loadInspectionSetup().then((setup) => active && setState((current) => ({ ...current, setup, loading: false }))).catch((error) => active && setState((current) => ({ ...current, loading: false, error: error.message })));
    return () => { active = false; };
  }, []);

  const run = useCallback(async (action) => {
    setState((current) => ({ ...current, working: true, error: "" }));
    try { const value = await action(); setState((current) => ({ ...current, working: false })); return value; }
    catch (error) { setState((current) => ({ ...current, working: false, error: error.message || "Không thể thực hiện thao tác." })); return null; }
  }, []);

  const begin = useCallback(async (branchUuid, employeeIds) => {
    const id = await run(() => startInspection(branchUuid, employeeIds));
    if (!id) return false;
    const inspection = await run(() => loadInspection(id));
    if (!inspection) return false;
    setState((current) => ({ ...current, inspection, setup: { ...current.setup, sections: inspection.sections, items: inspection.items } }));
    return true;
  }, [run]);

  const resume = useCallback(async (inspectionId) => {
    const inspection = await run(() => loadInspection(inspectionId));
    if (!inspection) return false;
    setState((current) => ({ ...current, inspection, setup: { ...current.setup, sections: inspection.sections, items: inspection.items } }));
    return true;
  }, [run]);

  const saveAnswer = useCallback(async (payload) => {
    const answerId = await run(() => saveInspectionAnswer(payload));
    if (!answerId) return null;
    setState((current) => {
      const previous = current.inspection.answers.find((answer) => answer.item_id === payload.itemId);
      const nextAnswer = { ...previous, id: answerId, inspection_id: payload.inspectionId, item_id: payload.itemId, result: payload.result, note: payload.note || "", responsibility_scope: payload.responsibilityScope || "store" };
      const selectedEmployeeIds = payload.responsibilityScope === "employees" ? (payload.employeeIds || []) : [];
      const nextAnswerEmployees = [
        ...current.inspection.answerEmployees.filter((link) => link.answer_id !== answerId && link.answer_id !== previous?.id),
        ...current.inspection.participants
          .filter((participant) => selectedEmployeeIds.includes(participant.employee_id))
          .map((participant) => ({ answer_id: answerId, participant_id: participant.id }))
      ];
      return { ...current, inspection: { ...current.inspection, answers: [...current.inspection.answers.filter((answer) => answer.item_id !== payload.itemId), nextAnswer], answerEmployees: nextAnswerEmployees } };
    });
    return answerId;
  }, [run]);

  const uploadEvidence = useCallback(async (payload) => {
    const evidence = await run(() => uploadInspectionEvidence(payload));
    if (evidence) setState((current) => ({ ...current, inspection: { ...current.inspection, evidence: [...current.inspection.evidence, evidence] } }));
    return evidence;
  }, [run]);

  const deleteEvidence = useCallback(async (evidence) => {
    const deletedId = await run(() => deleteInspectionEvidence(evidence));
    if (deletedId) setState((current) => ({ ...current, inspection: { ...current.inspection, evidence: current.inspection.evidence.filter((item) => item.id !== deletedId) } }));
    return Boolean(deletedId);
  }, [run]);

  const confirmParticipant = useCallback(async (payload) => {
    const confirmation = await run(() => saveInspectionConfirmation(payload));
    if (payload.confirmed && confirmation) {
      const nextConfirmation = { ...confirmation, signature_signed_url: payload.signatureSignedUrl || confirmation.signature_signed_url || "" };
      setState((current) => ({ ...current, inspection: { ...current.inspection, confirmations: [...current.inspection.confirmations.filter((item) => item.participant_id !== payload.participantId), nextConfirmation] } }));
      return true;
    }
    if (!payload.confirmed) {
      setState((current) => ({ ...current, inspection: { ...current.inspection, confirmations: current.inspection.confirmations.filter((item) => item.participant_id !== payload.participantId) } }));
      return true;
    }
    return false;
  }, [run]);

  const signParticipant = useCallback(async ({ inspectionId, participantId, file, employeeComment = "" }) => {
    const uploadedSignature = await run(() => uploadInspectionSignature({ inspectionId, participantId, file }));
    if (!uploadedSignature?.objectPath) return false;
    return confirmParticipant({ inspectionId, participantId, confirmed: true, method: "signature", signatureObjectPath: uploadedSignature.objectPath, signatureSignedUrl: uploadedSignature.signedUrl, employeeComment });
  }, [confirmParticipant, run]);

  const finish = useCallback(async (notes) => {
    const result = await run(() => submitInspection(state.inspection.inspection.id, notes));
    if (result) setState((current) => ({ ...current, result }));
    return result;
  }, [run, state.inspection]);

  return { ...state, begin, resume, saveAnswer, uploadEvidence, deleteEvidence, confirmParticipant, signParticipant, finish };
}
