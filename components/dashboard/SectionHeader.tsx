export default function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
      {description && (
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{description}</p>
      )}
    </div>
  );
}
