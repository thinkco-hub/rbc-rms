import { useId } from "react";
import Modal from "../common/Modal";

interface RestockChoiceModalProps {
  itemName: string;
  onDirectRestock: () => void;
  onScheduleRun: () => void;
  onClose: () => void;
}

const optionCls =
  "w-full text-left px-4 py-3.5 rounded-xl border border-gray-300 hover:border-[var(--color-brand-text)] hover:bg-orange-50 transition-colors";

export default function RestockChoiceModal({
  itemName,
  onDirectRestock,
  onScheduleRun,
  onClose,
}: RestockChoiceModalProps) {
  const headingId = useId();
  return (
    <Modal
      labelledBy={headingId}
      onClose={onClose}
      className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl w-full max-w-sm animate-fadeIn"
    >
        <h2 id={headingId} className="text-2xl font-bold text-[#121212] mb-1">Restock {itemName}</h2>
        <p className="text-gray-500 text-sm mb-6">How is this stock arriving?</p>

        <div className="space-y-3">
          <button onClick={onDirectRestock} className={optionCls}>
            <span className="block font-bold text-[#121212]">Add stock directly</span>
            <span className="block text-sm text-gray-500 mt-0.5">
              Stock received or made outside a production run.
            </span>
          </button>
          <button onClick={onScheduleRun} className={optionCls}>
            <span className="block font-bold text-[#121212]">Schedule a production run</span>
            <span className="block text-sm text-gray-500 mt-0.5">
              Bake it — the run consumes ingredients and adds finished goods.
            </span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 rounded-xl border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
    </Modal>
  );
}
