export interface FaqEntry { question: string; answer: string }
export interface RuleEntry { title: string; text: string; tone: 'allowed' | 'warning' | 'prohibited' | 'neutral' }
export interface PrivacyEntry { title: string; text: string; bullets?: string[] }

export interface FaqContent {
  hero: string;
  updated: string;
  rulesIntro: string;
  rules: RuleEntry[];
  questions: FaqEntry[];
  privacyIntro: string;
  privacy: PrivacyEntry[];
}

export const faqContent: Record<'ru' | 'en', FaqContent> = {
  ru: {
    hero: 'Всё о прогрессе, экономике, правилах и ваших данных — простыми словами.',
    updated: 'Обновлено 24 августа 2026 года',
    rulesIntro: 'Играйте как удобно, но не мешайте другим и не создавайте чрезмерную нагрузку на сервер. Мультиаккаунты и автокликеры разрешены в разумных пределах.',
    rules: [
      { title: 'Мультиаккаунты разрешены', text: 'Можно иметь несколько аккаунтов. Нельзя использовать их для массового получения одноразовых наград, искусственного влияния на Forbes или маркет, обхода блокировки либо других действий, которые дают нечестное преимущество и вредят экономике.', tone: 'allowed' },
      { title: 'Автокликеры и макросы разрешены', text: 'Можно автоматизировать обычные клики. Запрещены крайне низкие задержки в миллисекундах, непрерывный поток запросов, обход серверных ограничений или настройки, создающие нагрузку и нестабильность. Если автоматизация мешает игре или серверу — это уже злоупотребление.', tone: 'allowed' },
      { title: 'Баги нужно сообщать', text: 'Случайно найденная ошибка не является нарушением. Но намеренно повторять её ради денег, предметов, рейтинга или дублирования прогресса нельзя. Сообщите о проблеме через раздел «Поддержка».', tone: 'warning' },
      { title: 'Нельзя подменять игровые данные', text: 'Запрещены изменение запросов, подделка серверных ответов, вмешательство в Supabase, обход авторизации и другие попытки изменить защищённые данные вне обычного интерфейса игры.', tone: 'prohibited' },
      { title: 'Без мошенничества на маркете', text: 'Договорные сделки между своими аккаунтами сами по себе разрешены, но нельзя обманывать игроков, искусственно разгонять цены, создавать ложный спрос или использовать ошибки маркета.', tone: 'warning' },
      { title: 'Нормальное общение', text: 'Запрещены угрозы, травля, спам, выдача себя за администрацию и оскорбительные никнеймы, описания, баннеры, названия кланов или номерные знаки.', tone: 'neutral' },
      { title: 'Никакой торговли за реальные деньги', text: 'Продажа аккаунтов, игровой валюты, предметов или услуг за реальные деньги без официально добавленной игровой системы запрещена. Такие сделки не защищаются поддержкой.', tone: 'prohibited' },
      { title: 'Не обходите ограничения', text: 'Нельзя использовать новые аккаунты, VPN, скрипты или другие способы для обхода блокировки, лимита, проверки или решения модерации.', tone: 'prohibited' },
      { title: 'Меры применяются по ситуации', text: 'В зависимости от тяжести возможны предупреждение, отмена нечестно полученного прогресса, временное ограничение или блокировка. Ошибочное решение можно обжаловать через «Поддержку».', tone: 'neutral' },
      { title: 'Правила могут обновляться', text: 'При развитии игры правила могут меняться. Дата обновления всегда указана наверху; существенные изменения желательно сопровождать уведомлением внутри игры.', tone: 'neutral' },
    ],
    questions: [
      { question: 'Как сохраняется прогресс?', answer: 'Без аккаунта прогресс хранится в браузере и не переносится на другое устройство. После регистрации или входа сохранение синхронизируется с Supabase. Входите в один и тот же аккаунт, чтобы продолжить игру в другом браузере.' },
      { question: 'Что произойдёт с гостевым прогрессом после регистрации?', answer: 'Игра должна перенести текущий гостевой прогресс в созданный аккаунт. Не закрывайте страницу во время первого входа. Если данные не появились, не начинайте заново и сразу создайте обращение в «Поддержке».' },
      { question: 'Как открыть бизнес?', answer: 'Сначала оформите предпринимательскую лицензию, затем зарегистрируйте название и направление предприятия. После этого постройте объект, закупите оборудование, организуйте процессы и наймите сотрудников. До полного запуска предприятие не приносит доход.' },
      { question: 'Как считается прибыль бизнеса?', answer: 'Игра сначала рассчитывает валовую выручку, затем автоматически вычитает зарплаты сотрудников, операционные расходы и налог. На баланс поступает только чистая прибыль.' },
      { question: 'Как работают акции и криптовалюта?', answer: 'Цены едины для всех игроков и меняются по общей рыночной модели. В портфеле показываются количество, средняя цена покупки, текущая стоимость и прибыль или убыток. Доход не гарантирован: цена может как вырасти, так и упасть.' },
      { question: 'Что входит в состояние игрока и Forbes?', answer: 'Состояние отражает стоимость активов: бизнеса, имущества, недвижимости, транспорта, аксессуаров и инвестиционного портфеля. Обычный доступный баланс не должен искусственно увеличивать стоимость активов. Рейтинг обновляется по данным сохранённого профиля, поэтому возможна небольшая задержка синхронизации.' },
      { question: 'Можно ли потерять деньги в казино?', answer: 'Да. Казино использует игровую валюту и содержит риск случайного проигрыша. Оно не является способом гарантированного заработка. Реальные деньги в ставках не используются.' },
      { question: 'Как получить другую банковскую карту?', answer: 'Базовая карта доступна сразу. Некоторые дизайны покупаются за игровую валюту, другие выдаются за достижение определённого уровня. У активной карты можно настроить цвет, последние четыре цифры и игровой срок действия.' },
      { question: 'Разрешены ли мультиаккаунты?', answer: 'Да. Можно играть с нескольких аккаунтов, пока это не используется для обхода ограничений, массового фарма одноразовых наград, манипуляции рейтингом или рынком и других злоупотреблений.' },
      { question: 'Разрешён ли автокликер?', answer: 'Да, при разумной частоте. Настройки с крайне низкой задержкой, создающие поток запросов или нагрузку на сервер, считаются злоупотреблением. Серверные лимиты всегда имеют приоритет.' },
      { question: 'Почему цена или прогресс не сразу видны на другом устройстве?', answer: 'Проверьте, что выполнен вход в тот же аккаунт и есть интернет. Дождитесь завершения синхронизации и обновите страницу. Не очищайте данные браузера у гостевой игры — их невозможно восстановить с сервера.' },
      { question: 'Как изменить никнейм?', answer: 'Откройте «Настройки» и выберите изменение никнейма. Имя должно соответствовать ограничениям длины, быть свободным и не нарушать правила общения.' },
      { question: 'Что делать, если нашёл баг или потерял прогресс?', answer: 'Откройте раздел «Поддержка», подробно опишите действие перед ошибкой, укажите браузер и приложите текст из консоли или скриншот. Не повторяйте баг ради выгоды — это усложняет восстановление.' },
      { question: 'Как удалить аккаунт и данные?', answer: 'Создайте обращение в разделе «Поддержка» с аккаунта, который хотите удалить. Для защиты от чужого запроса может потребоваться подтверждение владения. После проверки разработчик удалит или обезличит данные, кроме записей, которые необходимо временно сохранить для безопасности или выполнения закона.' },
    ],
    privacyIntro: 'Коротко: мы собираем только данные, необходимые для аккаунта, сохранения и многопользовательских функций. Мы не продаём персональные данные и сейчас не используем рекламные трекеры. Ниже подробно описано, что именно происходит.',
    privacy: [
      { title: '1. Кто отвечает за данные', text: 'За работу Financial Clicker: Business Empire и обработку игровых данных отвечает разработчик trgrnw. По вопросам приватности используйте раздел «Поддержка» внутри игры или официальный Telegram разработчика: https://t.me/trgrnw.' },
      { title: '2. Данные аккаунта', text: 'При регистрации обрабатываются email, внутренний идентификатор аккаунта, никнейм и время создания или обновления профиля. Пароль принимает и защищает система авторизации Supabase: разработчик игры не видит пароль в открытом виде.', bullets: ['Email не показывается другим игрокам.', 'Никнейм и числовой ID игрока могут быть публичными.', 'Для восстановления доступа используется указанный email.'] },
      { title: '3. Игровой прогресс', text: 'Для облачного сохранения хранится игровой прогресс: баланс, опыт и уровень, покупки, имущество, бизнесы, инвестиции, настройки карт, достижения и другие игровые показатели. Также может храниться рассчитанное состояние и время последнего сохранения.' },
      { title: '4. Общение и сетевые функции', text: 'Если вы используете маркет, казино, кланы, чат, приглашения, жалобы или поддержку, сохраняются связанные игровые действия и созданный вами контент. Это необходимо для проведения операций, отображения истории, разрешения споров и модерации.' },
      { title: '5. Что видно другим игрокам', text: 'Публичными могут быть никнейм, Player ID, аватар, описание, баннер, витрины, состояние и позиция в Forbes, клан, рыночные объявления и сообщения в общих игровых пространствах. Не размещайте там email, настоящее имя, адрес или другую чувствительную информацию.' },
      { title: '6. Локальное хранение', text: 'Браузер использует localStorage для гостевого прогресса, сессии входа, языка, темы и резервного кэша сохранения. Эти данные остаются на устройстве до очистки браузера. Рекламные cookie и сторонняя аналитика в текущей версии игры не используются.' },
      { title: '7. Зачем используются данные', text: 'Данные нужны для создания и защиты аккаунта, запуска игры, сохранения между устройствами, рейтингов и сетевых функций, поддержки, предотвращения мошенничества, исправления ошибок и соблюдения правил. Мы не используем игровой профиль для продажи рекламы.' },
      { title: '8. Где хранятся данные и кому передаются', text: 'Облачные данные и авторизация работают через Supabase; сайт размещён на GitHub Pages. Эти поставщики могут обрабатывать технические сведения по собственным условиям и политике конфиденциальности. Данные не продаются. Доступ администрации ограничивается задачами поддержки, безопасности и управления игрой.', bullets: ['Политика Supabase: https://supabase.com/privacy', 'Политика GitHub: https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement', 'Внешние ссылки открывают сайты с собственными политиками.'] },
      { title: '9. Срок хранения', text: 'Данные аккаунта хранятся, пока аккаунт используется или пока они нужны для работы игры. Автоматический срок удаления неактивного аккаунта пока не установлен. После подтверждённого запроса данные удаляются или обезличиваются в разумный срок; отдельные журналы безопасности и резервные копии могут сохраняться ограниченное время по техническим или юридическим причинам.' },
      { title: '10. Ваши права и выбор', text: 'В зависимости от страны вы можете запросить сведения о своих данных, исправление, удаление, ограничение обработки, возражение или перенос данных. Никнейм и часть профиля можно менять самостоятельно. Остальные запросы направляйте через «Поддержку»; для защиты аккаунта потребуется подтвердить личность.' },
      { title: '11. Безопасность', text: 'Используются авторизация Supabase, разграничение доступа к таблицам и серверные проверки операций. Однако абсолютной безопасности не существует. Используйте уникальный пароль, не передавайте ссылку или код входа и сообщайте о подозрительной активности.' },
      { title: '12. Возраст', text: 'Игра не предназначена для детей младше 13 лет. Если законодательство вашей страны требует согласия родителя или опекуна для использования онлайн-сервисов, получите такое согласие перед регистрацией.' },
      { title: '13. Изменения политики', text: 'Политика может обновляться вместе с функциями игры или требованиями закона. Новая версия публикуется в этом разделе с актуальной датой. При существенных изменениях разработчик постарается показать уведомление внутри игры.' },
    ],
  },
  en: {
    hero: 'Everything about progress, economy, fair play and your data — in plain language.',
    updated: 'Updated August 24, 2026',
    rulesIntro: 'Play the way you like, but do not disrupt other players or place excessive load on the service. Multiple accounts and auto-clickers are allowed within reasonable limits.',
    rules: [
      { title: 'Multiple accounts are allowed', text: 'You may own several accounts. Do not use them to mass-farm one-time rewards, manipulate Forbes or the market, evade a restriction, or gain an unfair advantage that damages the economy.', tone: 'allowed' },
      { title: 'Auto-clickers and macros are allowed', text: 'Ordinary click automation is permitted. Extremely low millisecond delays, continuous request floods, bypassing server limits, or settings that cause instability are abuse.', tone: 'allowed' },
      { title: 'Report bugs', text: 'Finding a bug by accident is not a violation. Repeating it for money, items, rankings or duplicated progress is prohibited. Report it through Support.', tone: 'warning' },
      { title: 'Do not tamper with protected data', text: 'Modified requests, forged server responses, interference with Supabase, authorization bypasses and other attempts to change protected data outside the normal interface are prohibited.', tone: 'prohibited' },
      { title: 'No market fraud', text: 'Deals between your own accounts are not automatically prohibited, but deception, artificial price inflation, fake demand and exploitation of market bugs are not allowed.', tone: 'warning' },
      { title: 'Respect other players', text: 'Threats, harassment, spam, impersonating staff, and offensive usernames, descriptions, banners, clan names or license plates are prohibited.', tone: 'neutral' },
      { title: 'No real-money trading', text: 'Do not sell accounts, game currency, items or services for real money unless an official system is added. Support cannot protect unofficial transactions.', tone: 'prohibited' },
      { title: 'Do not evade restrictions', text: 'New accounts, VPNs, scripts or other methods must not be used to evade bans, limits, checks or moderation decisions.', tone: 'prohibited' },
      { title: 'Enforcement is proportional', text: 'Depending on severity, action may include a warning, removal of unfair progress, a temporary restriction or a ban. You may appeal a mistake through Support.', tone: 'neutral' },
      { title: 'Rules may evolve', text: 'Rules may change as the game develops. The latest update date appears above, and material changes should be announced in the game.', tone: 'neutral' },
    ],
    questions: [
      { question: 'How is progress saved?', answer: 'Guest progress stays in the current browser. Registered progress is synchronized through Supabase. Sign in to the same account to continue on another browser or device.' },
      { question: 'What happens to guest progress after registration?', answer: 'The game should migrate your current guest save into the new account. Keep the page open during the first sign-in. If it is missing, stop playing and contact Support.' },
      { question: 'How do I open a business?', answer: 'Obtain an entrepreneur licence, register a name and industry, then build the premises, buy equipment, organize operations and hire staff. A company earns nothing until fully launched.' },
      { question: 'How is business profit calculated?', answer: 'Gross revenue is reduced by employee salaries, operating costs and tax. Only net profit reaches your balance.' },
      { question: 'How do investments work?', answer: 'Stocks and crypto use shared prices for all players. Your portfolio shows quantity, average cost, current value and profit or loss. Returns are never guaranteed.' },
      { question: 'What counts toward net worth and Forbes?', answer: 'Net worth represents owned assets such as businesses, property, vehicles, accessories and investments. Your spendable cash should not artificially inflate asset value. Rankings may briefly lag behind the latest save.' },
      { question: 'Can I lose money in the casino?', answer: 'Yes. Casino games use game currency and involve random loss. They are not guaranteed income and do not accept real-money bets.' },
      { question: 'How do I get another bank card?', answer: 'The starter card is free. Some designs cost game currency and others unlock at specific levels. You may customize the active card’s color, last four digits and in-game expiry.' },
      { question: 'Are multiple accounts allowed?', answer: 'Yes, unless they are used to evade restrictions, mass-farm rewards, manipulate rankings or markets, or commit other abuse.' },
      { question: 'Are auto-clickers allowed?', answer: 'Yes at a reasonable rate. Extremely low delays that flood requests or burden the service are abuse. Server-side limits always take priority.' },
      { question: 'Why is progress delayed on another device?', answer: 'Confirm that you used the same account and have internet access, wait for synchronization, then refresh. Guest data cannot be restored from the cloud after browser data is cleared.' },
      { question: 'How do I change my nickname?', answer: 'Open Settings and choose Change nickname. It must meet the length rules, be available and comply with community rules.' },
      { question: 'What should I do after a bug or lost save?', answer: 'Open Support and include the action before the error, browser, console text and screenshots. Do not repeat an exploit for gain.' },
      { question: 'How do I delete my account and data?', answer: 'Submit a ticket from the account you want removed. Ownership verification may be required. Data will then be deleted or anonymized except for limited records needed for security or legal compliance.' },
    ],
    privacyIntro: 'In short: we collect only what is needed for accounts, saving and multiplayer features. We do not sell personal data and currently use no advertising trackers.',
    privacy: [
      { title: '1. Who is responsible', text: 'Financial Clicker: Business Empire is operated by developer trgrnw. Contact us through in-game Support or the official Telegram account: https://t.me/trgrnw.' },
      { title: '2. Account data', text: 'Registration processes your email, account ID, nickname and profile timestamps. Supabase handles and protects your password; the game developer cannot view it in plain text.', bullets: ['Email is not public.', 'Nickname and numeric Player ID may be public.', 'Email is used for confirmation and account recovery.'] },
      { title: '3. Game progress', text: 'Cloud saves may contain balance, XP, level, purchases, property, businesses, investments, card settings, achievements and related game statistics, plus calculated net worth and save time.' },
      { title: '4. Social and online activity', text: 'Market, casino, clans, chat, invitations, reports and Support create transaction or content records needed to perform actions, show history, resolve disputes and moderate the service.' },
      { title: '5. Public information', text: 'Nickname, Player ID, avatar, description, banner, showcases, net worth, Forbes rank, clan, listings and public-space messages may be visible to players. Never post your email, real name, address or sensitive data there.' },
      { title: '6. Browser storage', text: 'localStorage keeps guest progress, sign-in session, language, theme and a backup save cache. It remains until browser data is cleared. The current game uses no advertising cookies or third-party analytics.' },
      { title: '7. Why data is used', text: 'We use data to create and secure accounts, run and synchronize the game, provide rankings and online features, support players, prevent fraud, fix bugs and enforce rules. Profiles are not used to sell advertising.' },
      { title: '8. Providers and access', text: 'Supabase provides database, authentication, storage and server functions; GitHub Pages delivers the static website. Providers may process technical data under their own policies. Data is not sold, and staff access is limited to support, security and game operations.', bullets: ['Supabase privacy policy: https://supabase.com/privacy', 'GitHub privacy statement: https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement', 'External links have their own privacy terms.'] },
      { title: '9. Retention', text: 'Account data remains while the account is used or needed to operate the game. No automatic inactive-account deletion period is currently set. After a verified request, data is deleted or anonymized within a reasonable period; limited security logs and backups may remain temporarily.' },
      { title: '10. Your choices and rights', text: 'Depending on your location, you may request access, correction, deletion, restriction, objection or portability. Some profile data can be edited directly. Send other requests through Support; identity verification protects your account.' },
      { title: '11. Security', text: 'The game uses Supabase authentication, row-level access rules and server-side operation checks. No system is perfectly secure. Use a unique password, keep sign-in links private and report suspicious activity.' },
      { title: '12. Age', text: 'The game is not intended for children under 13. Where local law requires parental consent for online services, obtain it before registration.' },
      { title: '13. Policy changes', text: 'This policy may change with game features or legal requirements. The current date is shown above, and material updates should be announced in the game.' },
    ],
  },
};
