import Link from "next/link";
export function WizardFooter({ step, maximum }: { step: number; maximum: number }) {
  const style = "inline-flex min-h-10 items-center rounded-full px-5 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500";
  return (
    <nav aria-label="Wizard navigation" className="mt-6 flex items-center justify-between gap-3 border-t border-[#d8c6b2] pt-5 dark:border-[#596166]">
      {step > 1 ? (
        <Link prefetch={false} className={style} href={`/setup/workspace?step=${step - 1}`}>Back</Link>
      ) : <span />}
      {step < 5 && (step < maximum ? (
        <Link prefetch={false} className={style + " bg-[#F69629] text-white dark:text-slate-900"} href={`/setup/workspace?step=${step + 1}`}>Next</Link>
      ) : <button disabled className={style + " cursor-not-allowed opacity-50"}>Next</button>)}
    </nav>
  );
}
