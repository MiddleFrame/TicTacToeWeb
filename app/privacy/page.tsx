import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — Tic Tac Toe Plus",
  description: "Как Tic Tac Toe Plus использует игровые данные, рекламу и Google-аккаунт.",
};

export default function PrivacyPage() {
  return (
    <main className="privacy-shell">
      <article className="privacy-panel">
        <span className="eyebrow">Tic Tac Toe Plus</span>
        <h1>Политика конфиденциальности</h1>
        <p>Последнее обновление: 31 августа 2026 года.</p>
        <h2>Какие данные использует игра</h2>
        <p>
          Игра хранит ваш ник, игровой прогресс, колоду и баланс монет. На Android создаётся
          технический идентификатор гостевой сессии, чтобы синхронизировать прогресс и покупки.
        </p>
        <h2>Google-аккаунт</h2>
        <p>
          Если вы сами привяжете Google-аккаунт, игра получает подтверждённый Google ID и
          использует его только для восстановления вашего игрового профиля. Пароль Google игра
          не получает.
        </p>
        <h2>Реклама и возраст</h2>
        <p>
          Реклама показывается только по вашему запросу за игровую награду. Указанный возраст и
          выбор персонализации сохраняются на устройстве и передаются рекламному SDK как настройки
          COPPA, GDPR и CCPA. Рекламные партнёры могут обрабатывать технические данные устройства,
          примерное местоположение и события показа согласно собственным правилам.
        </p>
        <h2>Сторонние сервисы</h2>
        <ul>
          <li><a href="https://www.yodo1.com/en/privacy/" target="_blank" rel="noreferrer">Yodo1 MAS</a> — показ рекламы.</li>
          <li><a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google</a> — вход в аккаунт и рекламные технологии.</li>
        </ul>
        <h2>Связь</h2>
        <p>
          По вопросам о данных напишите в <a href="https://discord.gg/4PJbjRZtkU" target="_blank" rel="noreferrer">сообщество игры в Discord</a>.
        </p>
      </article>
    </main>
  );
}
