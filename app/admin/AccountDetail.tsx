import type { AdminAccountDetail } from "../backend/admin-data";
import styles from "./admin.module.css";

function date(value: number): string {
  return new Date(value).toLocaleString("ru-RU");
}

const reasons: Record<string, string> = { "legacy-import": "Перенос старого прогресса", "store-purchase": "Покупка карт", "rewarded-ad": "Награда за рекламу" };
const statuses: Record<string, string> = { active: "Активен", banned: "Заблокирован", deleted: "Удалён" };

export default function AccountDetail({ detail }: { detail: AdminAccountDetail }) {
  const { account } = detail;
  return <article className={styles.panel} aria-label="Данные аккаунта">
    <h2>{account.nickname}</h2>
    <dl className={styles.facts}>
      <div><dt>Публичный код</dt><dd>{account.publicCode}</dd></div>
      <div><dt>Статус</dt><dd>{statuses[account.status] ?? account.status}</dd></div>
      <div><dt>Монеты</dt><dd>{account.coins}</dd></div>
      <div><dt>Косметическая валюта</dt><dd>{account.cosmeticCurrency}</dd></div>
      <div><dt>Создан</dt><dd>{date(account.createdAt)}</dd></div>
      <div><dt>ID аккаунта</dt><dd>{account.id}</dd></div>
    </dl>
    <h3>Инвентарь · {detail.inventory.length}{detail.moreInventory ? "+" : ""}</h3>
    {detail.inventory.length ? <ul className={styles.inventory}>
      {detail.inventory.map((item) => <li key={item.itemId}>{item.itemId} <strong>×{item.quantity}</strong></li>)}
    </ul> : <p>Инвентарь пуст.</p>}
    {detail.moreInventory && <p>Показаны первые 200 предметов.</p>}
    <h3>История валюты</h3>
    <p>Последние {detail.ledger.length} операций{detail.moreLedger ? " из более чем 50" : ""}. Баланс не редактируется напрямую.</p>
    {detail.ledger.length ? <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="История начислений и списаний">
      <table><thead><tr><th>Когда</th><th>Причина</th><th>Валюта</th><th>Изменение</th><th>После</th></tr></thead>
        <tbody>{detail.ledger.map((entry) => <tr key={entry.id}>
          <td>{date(entry.createdAt)}</td>
          <td>{reasons[entry.reason] ?? entry.reason}<small>{entry.operationId}</small></td>
          <td>{entry.currency === "coins" ? "Монеты" : "Косметическая"}</td>
          <td>{entry.amount > 0 ? "+" : ""}{entry.amount}</td><td>{entry.balanceAfter}</td>
        </tr>)}</tbody>
      </table>
    </div> : <p>Операций пока нет.</p>}
    <h3>Журнал доступа</h3>
    <p>Последние 20 просмотров этого аккаунта.</p>
    <ul>{detail.audit.map((entry) => <li key={entry.id}>
      {date(entry.createdAt)} — {entry.action === "account-view" ? "Просмотр аккаунта" : entry.action}
      <small>Администратор: {entry.actorUserId ?? "удалённый аккаунт"}</small>
    </li>)}</ul>
  </article>;
}
