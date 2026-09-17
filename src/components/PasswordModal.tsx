import { useState, type FormEvent, type ReactNode } from "react";
import { useApp } from "../store";
import { Field, GhostButton, Modal, PrimaryButton, inputClass } from "./ui";

export function PasswordModal({
  open,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const stored = useApp((s) => s.accessPassword);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (value.trim() !== stored) {
      setError("Неверный пароль");
      return;
    }
    setValue("");
    setError("");
    onConfirm();
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        setValue("");
        setError("");
        onClose();
      }}
    >
      <form className="space-y-3" onSubmit={submit}>
        <p className="text-sm text-muted">{description}</p>
        <Field label="Пароль">
          <input
            className={inputClass}
            type="password"
            autoComplete="current-password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
          />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <GhostButton
            type="button"
            onClick={() => {
              setValue("");
              setError("");
              onClose();
            }}
          >
            Отмена
          </GhostButton>
          <PrimaryButton type="submit">{confirmLabel}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
