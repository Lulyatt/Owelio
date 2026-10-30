# Expense-Splitting Tool --- Project Scope

## 1. Project overview

A general-purpose expense-splitting application. Users can create groups
for different occasions or ongoing shared expenses, record costs, decide
how each cost is divided, and track what members owe one another.

The tool should work for a wide range of situations, including holidays,
meals, events, households, flatmates and groups of friends.

## 2. Decisions made

  -----------------------------------------------------------------------
  Area                                Agreed direction
  ----------------------------------- -----------------------------------
  Primary use case                    General-purpose tool: users can
                                      create groups for any purpose

  Expense-splitting methods           Support all four methods: equal,
                                      custom amounts, percentages and
                                      itemised splitting

  Joining groups                      Support invitation links, email
                                      invitations and unique join codes

  Accounts                            Mandatory accounts: every user must
                                      register and log in; no guest
                                      access

  Group permissions                   All members have equal permissions
                                      and can add, edit and delete
                                      expenses

  Settling debts                      Calculate an optimised set of
                                      payments and allow members to
                                      record settlements in the app

  Currencies                          Support multiple currencies; users
                                      enter the exchange rate manually

  Group types                         Support both temporary groups and
                                      ongoing groups

  Group archiving                     Allow manual archiving and
                                      automatic archiving when all
                                      balances reach zero; archived
                                      groups remain available as
                                      read-only history

  Expense visibility                  Full transparency: all members can
                                      see all group expenses and their
                                      details

  Expense details                     Support descriptions, amounts,
                                      dates, categories, notes and
                                      receipt/document attachments

  Expense participants                The person adding an expense
                                      manually selects which members are
                                      included each time

  Recurring expenses                  Support expenses that are added
                                      automatically on a schedule

  Notifications                       In-app notifications only; no email
                                      notifications

  Personal dashboard                  Basic dashboard showing total owed,
                                      total others owe the user, and a
                                      list of groups

  Data export                         Not yet decided
  -----------------------------------------------------------------------

## 3. Functional requirements

### 3.1 Accounts and group membership

-   Users must register and log in to use the application.
-   Users can create multiple groups.
-   Users can invite others using:
    -   A shareable invitation link.
    -   An email invitation.
    -   A unique join code.
-   All members of a group have equal permissions.
-   All members can add, edit and delete expenses.
-   Group members can see all expenses and relevant group information.

### 3.2 Groups

Groups can be used for either: - **Temporary occasions:** for example, a
holiday, weekend away or event. - **Ongoing expenses:** for example, a
household or a regular group of friends.

Groups can be archived manually or automatically when all balances reach
zero. Archived groups remain accessible as read-only history.

### 3.3 Expenses

Members can add expenses to a group. Each expense should support:

-   Description.
-   Amount and currency.
-   Date.
-   Category.
-   Optional notes.
-   Receipt images and document attachments.
-   The member who paid.
-   The members included in the expense.
-   The selected splitting method and its breakdown.

The person adding an expense manually chooses which group members are
included. The app should not automatically include every group member.

### 3.4 Splitting methods

Each expense can use a different splitting method:

1.  **Equal split:** divide the expense equally between selected
    participants.
2.  **Custom amounts:** specify exactly how much each participant owes.
3.  **Percentage split:** allocate the expense using percentages.
4.  **Itemised split:** add individual items and assign them to the
    relevant participants.

The application should show the resulting breakdown clearly so members
can understand how each person's share was calculated.

### 3.5 Multiple currencies

-   Groups can contain expenses in different currencies.
-   Users manually specify the exchange rate used to convert an expense
    into the group's base currency.
-   The application should use the supplied rate for balance
    calculations rather than relying on automatic exchange-rate lookups.

*The exact way the group base currency is selected and how exchange
rates are entered or corrected still needs to be designed.*

### 3.6 Balances and settlements

The application should calculate each member's overall position within a
group.

It should: - Show who owes money and who is owed money. - Simplify group
debts into an optimised set of payments, aiming to minimise the number
of transactions needed to settle the group's balances. - Allow members
to record payments they have made to other members. - Update balances
when settlements are recorded. - Keep settlement information visible to
group members.

The application records settlements; it does not need to process real
payments as part of the agreed scope.

### 3.7 Recurring expenses

Members can configure expenses to be added automatically on a recurring
schedule, such as daily, weekly or monthly.

The exact recurrence options, handling of failed or missed additions,
and how changes to a recurring expense affect future entries remain to
be specified.

### 3.8 Notifications

Provide in-app notifications for relevant group activity. Email
notifications are not required.

The precise notification events and user controls for notification
preferences remain to be defined.

### 3.9 Personal dashboard

Provide a basic dashboard showing: - Total amount the user owes. - Total
amount other members owe the user. - A list of the user's groups.

### 3.10 Exporting data

Data export was raised but no option was selected. The following remain
open: - No export. - CSV export. - PDF reports. - Both CSV and PDF.

## 4. Open decisions

These points were not settled during the initial brainstorming and
should be discussed before implementation:

1.  **Data export:** Should users be able to export data as CSV, PDF,
    both or neither?
2.  **Group base currency:** How is a group's base currency chosen, and
    how are manual exchange rates applied?
3.  **Recurring expenses:** Which schedules should be supported, and how
    should users pause, edit or cancel them?
4.  **Automatic archiving:** Should a group archive immediately when all
    balances reach zero, or should users be able to configure or cancel
    automatic archiving?
5.  **Notifications:** Which events should trigger in-app notifications,
    and can users control them?
6.  **Expense editing and deletion:** How should the app handle edits or
    deletions after a settlement has been recorded?
7.  **Rounding:** How should fractional pennies and currency conversion
    rounding be handled?

## 5. Current scope at a glance

The agreed direction is a multi-user application with mandatory
accounts, flexible groups, four expense-splitting methods, manual
participant selection, multi-currency support with manually entered
rates, recurring expenses, transparent group activity, optimised debt
settlement and in-app notifications.

The project scope is now captured at a product level. Technical
architecture, database design, detailed user journeys and implementation
priorities can be decided separately.
