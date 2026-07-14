import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const inputClass =
  'w-full px-3 py-2.5 min-h-[42px] border-2 border-black bg-[#12141c] font-mono text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-shadow focus:shadow-[3px_3px_0px_0px_rgba(250,204,21,0.35)] focus:border-amber-400/40 disabled:opacity-50 disabled:cursor-not-allowed'

const textareaClass =
  'w-full px-3 py-2.5 min-h-[72px] border-2 border-black bg-[#12141c] font-mono text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-shadow focus:shadow-[3px_3px_0px_0px_rgba(250,204,21,0.35)] focus:border-amber-400/40 disabled:opacity-50 disabled:cursor-not-allowed resize-y'

export const BrutalInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function BrutalInput({ className = '', ...props }, ref) {
    return <input ref={ref} className={`${inputClass} ${className}`.trim()} {...props} />
  }
)

export const BrutalTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function BrutalTextarea({ className = '', ...props }, ref) {
  return <textarea ref={ref} className={`${textareaClass} ${className}`.trim()} {...props} />
})

export const brutalBtnClass =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wide border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.85)] transition-all hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.9)] hover:-translate-y-px disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,0.85)]'

export { inputClass as brutalInputClass, textareaClass as brutalTextareaClass }
