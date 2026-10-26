import { Button, Modal, Textarea } from '@mantine/core';
import { useId, useState, type ReactNode } from 'react';

export function AdminAvatar({
  children,
  tone = 'blue',
}: {
  children: ReactNode;
  tone?: 'blue' | 'bad';
}) {
  return (
    <span className={`admin-avatar admin-avatar--${tone}`} aria-hidden="true">
      {children}
    </span>
  );
}

export function AdminRows({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="admin-rows">
      {rows.map((row) => (
        <div className="admin-row" key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminResult({
  tone = 'ok',
  children,
}: {
  tone?: 'ok' | 'warn';
  children: ReactNode;
}) {
  return (
    <div className={`admin-result admin-result--${tone}`} role="status">
      {children}
    </div>
  );
}

interface MotivoDialogProps {
  open: boolean;
  title: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  required?: boolean;
  loading?: boolean;
  danger?: boolean;
  onClose: () => void;
  onConfirm: (valor: string) => void;
}

export function MotivoDialog({
  open,
  title,
  label,
  placeholder,
  confirmLabel,
  required = true,
  loading = false,
  danger = false,
  onClose,
  onConfirm,
}: MotivoDialogProps) {
  return (
    <Modal opened={open} onClose={onClose} title={title} centered radius="lg">
      {/* El formulario se desmonta al cerrar el modal, por lo que el texto se reinicia solo. */}
      <MotivoForm
        label={label}
        placeholder={placeholder}
        confirmLabel={confirmLabel}
        required={required}
        loading={loading}
        danger={danger}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </Modal>
  );
}

type MotivoFormProps = Pick<
  MotivoDialogProps,
  | 'label'
  | 'placeholder'
  | 'confirmLabel'
  | 'required'
  | 'loading'
  | 'danger'
  | 'onClose'
  | 'onConfirm'
>;

function MotivoForm({
  label,
  placeholder,
  confirmLabel,
  required = true,
  loading = false,
  danger = false,
  onClose,
  onConfirm,
}: MotivoFormProps) {
  const [valor, setValor] = useState('');
  const valido = !required || valor.trim().length > 0;

  return (
    <div className="admin-modal">
      <Textarea
        label={label}
        placeholder={placeholder}
        value={valor}
        onChange={(event) => setValor(event.currentTarget.value)}
        autosize
        minRows={3}
        maxRows={6}
        maxLength={500}
        withAsterisk={required}
        data-autofocus
      />

      <div className="admin-modal__actions">
        <Button variant="default" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          color={danger ? 'red' : 'brand'}
          className={danger ? 'btn-danger' : undefined}
          disabled={!valido}
          loading={loading}
          onClick={() => onConfirm(valor.trim())}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  loading?: boolean;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  loading = false,
  danger = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal opened={open} onClose={onClose} title={title} centered radius="lg">
      <div className="admin-modal">
        <div className="admin-modal__text">{children}</div>
        <div className="admin-modal__actions">
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            color={danger ? 'red' : 'mint'}
            className={danger ? 'btn-danger' : 'btn-mint'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Estructura de ítems expandibles ---------- */

interface AdminItemProps {
  avatar: ReactNode;
  avatarTone?: 'blue' | 'bad';
  titulo: ReactNode;
  /** Fila de badges bajo el título (altas). */
  badges?: ReactNode;
  subtitulo?: ReactNode;
  /** Badge a la derecha del encabezado (bajas y denuncias). */
  estado?: ReactNode;
  /** Contenido del panel expandible. Si no se pasa, no hay chevron. */
  detalle?: ReactNode;
  acciones?: ReactNode;
  defaultOpen?: boolean;
}

export function AdminItem({
  avatar,
  avatarTone = 'blue',
  titulo,
  badges,
  subtitulo,
  estado,
  detalle,
  acciones,
  defaultOpen = false,
}: AdminItemProps) {
  const [abierto, setAbierto] = useState(defaultOpen);
  const panelId = useId();
  const expandible = detalle !== undefined && detalle !== null;

  return (
    <article className="admin-item">
      <div className="admin-item__head">
        <AdminAvatar tone={avatarTone}>{avatar}</AdminAvatar>

        <div className="admin-item__main">
          <h3 className="admin-item__title">{titulo}</h3>
          {badges && <div className="admin-item__badges">{badges}</div>}
          {subtitulo && <p className="admin-item__sub">{subtitulo}</p>}
        </div>

        {estado && <div className="admin-item__estado">{estado}</div>}

        {expandible && (
          <button
            type="button"
            className="admin-item__chevron"
            aria-expanded={abierto}
            aria-controls={panelId}
            aria-label={abierto ? 'Ocultar detalle' : 'Ver detalle'}
            onClick={() => setAbierto((v) => !v)}
          >
            <span aria-hidden="true">{abierto ? '⌃' : '⌄'}</span>
          </button>
        )}
      </div>

      {expandible && abierto && (
        <div id={panelId} className="admin-item__panel">
          {detalle}
        </div>
      )}

      {acciones && <div className="admin-item__actions">{acciones}</div>}
    </article>
  );
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return <div className="admin-empty">{children}</div>;
}

export function AdminLista({ children }: { children: ReactNode }) {
  return <div className="admin-list">{children}</div>;
}

export function AdminSkeleton() {
  return (
    <div className="admin-list" aria-busy="true" aria-label="Cargando">
      {[0, 1].map((n) => (
        <div key={n} className="admin-item admin-skeleton" />
      ))}
    </div>
  );
}