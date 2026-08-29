import { Search, Hammer, Send, BarChart3, Briefcase } from 'lucide-react';

const steps = [
  { num: '01', label: 'Pilih Project', Icon: Search, body: 'Pilih 1 project minggu ini yang paling relevan dengan minatmu.' },
  { num: '02', label: 'Kerjakan', Icon: Hammer, body: 'Kerjakan brief singkat dengan tools yang biasa kamu pakai.' },
  { num: '03', label: 'Submit Jumat', Icon: Send, body: 'Kumpulkan submission sebelum Jumat 23:59 WIB.' },
  { num: '04', label: 'Nilai Sabtu', Icon: BarChart3, body: 'Evaluator menilai berdasarkan rubric yang sudah ditentukan.' },
  { num: '05', label: 'Jadi Portfolio', Icon: Briefcase, body: 'Hasilnya masuk ke Career Report dan bisa kamu jadikan case study.' },
];

export function HowItWorks() {
  return (
    <div>
      <div className="hidden md:grid grid-cols-5 gap-4">
        {steps.map((s) => (
          <div
            key={s.num}
            className="relative rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--color-brand-600)] tracking-wider">
                {s.num}
              </span>
              <div className="h-9 w-9 rounded-[var(--radius-md)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] flex items-center justify-center">
                <s.Icon className="h-4 w-4" />
              </div>
            </div>
            <h4 className="mt-3 text-[15px] font-semibold text-[var(--color-ink-primary)]">{s.label}</h4>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-ink-tertiary)]">{s.body}</p>
          </div>
        ))}
      </div>

      {/* Mobile timeline */}
      <ol className="md:hidden flex flex-col gap-3">
        {steps.map((s) => (
          <li
            key={s.num}
            className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-4"
          >
            <div className="h-9 w-9 shrink-0 rounded-[var(--radius-md)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)] flex items-center justify-center">
              <s.Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[var(--color-brand-600)] tracking-wider">
                  {s.num}
                </span>
                <h4 className="text-[14px] font-semibold text-[var(--color-ink-primary)]">{s.label}</h4>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-ink-tertiary)]">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
