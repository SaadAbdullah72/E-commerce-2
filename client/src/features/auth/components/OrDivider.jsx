/** "or" line between the email form and the Google button. */
export default function OrDivider() {
  return (
    <div className="my-4 flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-gray-200" />
      <span className="text-[11px] font-medium text-gray-400">or</span>
      <span className="h-px flex-1 bg-gray-200" />
    </div>
  );
}
