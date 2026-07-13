"use client";

type Props = {
  step: number;
};

const STEPS = [
  { num: 1, title: "Upload Data" },
  { num: 2, title: "Map Columns" },
  { num: 3, title: "Generate PDFs" },
];

export default function WizardStepBar({ step }: Props) {
  return (
    <div className="flex border-b border-gray-200">
      {STEPS.map((s) => (
        <div
          key={s.num}
          className={`flex-1 py-4 text-center text-sm font-medium border-b-2 ${
            step >= s.num
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-500"
          }`}
        >
          Step {s.num}: {s.title}
        </div>
      ))}
    </div>
  );
}
