/* eslint-disable react/no-unescaped-entities */
import React from 'react';

const boldSpan = (text: string) => <span className="font-bold">{text}</span>;

export const bylaws = [
  {
    title: () => <>Article I. Organization Name</>,
    body: () => (
      <p>The name of the organization shall be the Down East Cyclist {boldSpan('(DEC)')}.</p>
    ),
    id: 'Section 1',
  },
  {
    title: () => <>Article II – Organization Purpose</>,
    body: () => (
      <p className="content">
        {boldSpan('DEC')} is dedicated to promoting and supporting recreational and competitive
        cycling activities. Our organization aims to educate cyclists in various areas of the sport
        of cycling, while also promoting safe cycling practices.{' '}
        <span className="italic">
          We actively encourage and support the development of public cycling facilities and
          programs, including bike paths, bike trails, educational courses, the local National
          Interscholastic Cycling Association Mountain Bike Team, and other public cycling
          activities.
        </span>{' '}
        Through these initiatives, {boldSpan('DEC ')}
        strives to foster a vibrant cycling community and create opportunities for cyclists of all
        levels to enjoy and excel in the sport.
      </p>
    ),
    id: 'Section 2',
  },
  {
    title: () => <>Article III – Membership</>,
    body: () => (
      <>
        <div className="content">
          <p>
            Membership is open to individuals and families who desire to promote the purposes of{' '}
            {boldSpan('DEC')} in the following categories:
          </p>
          <ul>
            <li>Individual Dues: $30/year or as recommended by the Executive Board</li>
            <li>
              Family Dues: $50/year or as recommended by the Executive Board (A family is defined as
              two or more people – including children under 18 years old – residing at the same
              residence.)
            </li>
          </ul>
          <p>
            {boldSpan('DEC')} is committed to creating an inclusive and welcoming environment for
            all individuals. No person joining {boldSpan('DEC')} shall be discriminated against
            because of race, color, creed, sex, age, disability, national origin, sexual
            orientation, or any other protected status. We are dedicated to ensuring that all
            members, participants, and volunteers are treated with respect and dignity, promoting
            equality and fairness within our organization and the broader cycling community.
          </p>
          <p>
            The Treasurer will log and track all active paid members and their annual due dates.
          </p>
          <p>
            The Secretary will provide a monthly report of all active members to local businesses
            that support club discounts.
          </p>
          <p>
            {boldSpan('DEC')} maintains transparent financial practices and ensures that any
            reimbursements provided to individual members for club-related expenses are reasonable
            and documented in accordance with club policies and procedures. The organization is
            committed to responsible fiscal management and the equitable distribution of resources
            to support the collective interests and endeavors of its members.
          </p>
          <p className="font-bold underline">Membership Rules</p>
          <ul>
            <li>Each Individual membership shall have one vote at General Meetings.</li>
            <li>Each Family membership shall have two votes at General Meetings.</li>
            <li>
              Any revisions or changes to the Membership Dues will be approved by the Executive
              Board and presented at the next club meeting for a General Club member vote.
            </li>
            <li>Each member must sign a {boldSpan('DEC')} waiver of liability.</li>
            <li>The membership period is valid for one year after the joining date.</li>
            <li>
              Each member shall abide by applicable traffic laws, rules, and regulations while
              engaged in a{boldSpan(' DEC')}-sponsored riding or racing activity. By adhering to
              these guidelines, {boldSpan('DEC')} members demonstrate their commitment to promoting
              safe and responsible cycling practices, both within the organization and in the wider
              community.{' '}
              <span className="italic">
                It is the collective responsibility of all members to uphold these standards and
                contribute to the positive image of cycling as a lawful and respectful mode of
                transportation and recreation.
              </span>
            </li>
            <li>
              No member of the {boldSpan('DEC')} shall use, distribute, or possess any illegal
              substance or drug while engaged in any {boldSpan('DEC')}-sponsored event or activity.{' '}
              {boldSpan('DEC')} promotes a healthy and drug-free environment for all members and
              participants.
            </li>
            <li>
              Members shall not possess a concealed weapon unless they are licensed to carry as
              defined by federal, state, or local laws. {boldSpan('DEC')}-sponsored events,
              including riding or racing activities, are intended to be safe and inclusive for all
              participants. Therefore, the possession of concealed weapons without proper licensing
              is strictly prohibited. Displaying a weapon, regardless of licensing status, is not
              permitted during any {boldSpan('DEC')}-sponsored event or activity.
              {boldSpan(' DEC')} values the safety and comfort of all members and participants, and
              the display of weapons may create an environment that is intimidating or unwelcoming.
              By adhering to these guidelines, {boldSpan('DEC')} members demonstrate their
              commitment to maintaining a safe and inclusive environment for all. It is the
              responsibility of each member to comply with these provisions and contribute to the
              positive and respectful atmosphere of {boldSpan('DEC')} events and activities.
            </li>
            <li>
              Membership may be terminated for cause for any act that is detrimental to the
              interests and benefit of {boldSpan('DEC')} or violates any {boldSpan('DEC')} policy or
              procedure. Such termination shall require the affirmative vote of 3/4 of the Executive
              Board. For each termination the Executive Board shall set forth procedures, as may be
              appropriate under the circumstances, to ensure fairness to both {boldSpan('DEC')} and
              to the member subject to termination.
            </li>
          </ul>
        </div>
      </>
    ),
    id: 'Section 3',
  },
  {
    title: () => <>Article IV – Meetings</>,
    body: () => (
      <>
        <div className="content">
          <p className="font-bold underline">General Meetings</p>
          <p>
            General Meetings of the members of {boldSpan('DEC')} shall be held on the second
            Wednesday of each month at 6:30 p.m. or as otherwise determined by the Executive Board.
            The meeting location will be determined and announced by the Executive Board via an
            approved method, i.e., email distribution, social media, website, or other electronic
            means.
          </p>
          <p className="font-bold underline">Annual Meeting & Election of Officers</p>
          <p>
            The Annual Meeting and Election of Officers shall be held at the regularly scheduled
            General Meeting for the month of January.
          </p>
        </div>
      </>
    ),
    id: 'Section 4',
  },
  {
    title: () => <>Article V - Officers & Election of Officers</>,
    body: () => (
      <>
        <div className="content">
          <p className="font-bold underline">Officers</p>
          <p>
            The elected officers of {boldSpan('DEC')} shall be the office of President,
            Vice-President, Treasurer, and Secretary. The four elected positions together comprise
            the Executive Board.
          </p>
          <p>The duties of the Officers shall be:</p>
          <ul>
            <li>
              <span className="font-bold">President - </span>
              Presides at General Meetings of {boldSpan('DEC')}; is responsible for the general
              management and fundraising activities of {boldSpan('DEC')}; may establish policies and
              procedures for the implementation of any {boldSpan('DEC')} activity and function.
            </li>
            <li>
              <span className="font-bold">Vice President – </span>
              Assists the President in carrying out {boldSpan('DEC')} activities and serves in his
              absence; organizes the club rides associated with New Year's Day, Memorial Day,
              Independence Day, Labor Day, and Thanksgiving (including submitting the start/finish
              location and route to the club members at least 30 days in advance); and organizes the
              December holiday party.
            </li>
            <li>
              <span className="font-bold">Treasurer - </span>
              Shall keep an account of all money received by and disbursed on behalf of the Club in
              accordance with generally accepted business practices which shall include at a
              minimum, provisions for the following:
              <ul>
                <li>
                  Cash receipts shall be deposited in the {boldSpan('DEC')} bank account the first
                  banking day after the day of receipt. A duplicate deposit slip, authenticated by
                  the bank, shall be retained as evidence of deposit.
                </li>
                <li>
                  Disbursements shall be made using preprinted and pre-numbered checks. All checks
                  or withdrawal slips must bear the signature of at least two members of the
                  Executive Board, one of whom shall be the Treasurer.
                </li>
                <li>
                  Bank statements shall be reconciled with the book balance each month. Such
                  reconciliations shall be accomplished in writing and shall be certified by the
                  Treasurer and one other member of the Board.
                </li>
                <li>
                  All receipts and disbursements shall be supported by adequate receipts, bills,
                  invoices, and other generally accepted accounting documents. Voucher files shall
                  be maintained for all receipts and disbursements and cross-referenced to payments
                  or deposits. Such vouchers shall briefly describe the income received or expense
                  incurred and shall be signed by the Treasurer.
                </li>
                <li>
                  Accounting records shall be maintained on a current basis and all records and
                  related documents preserved in such a manner as to be readily available for
                  audits.
                </li>
                <li>
                  A record of all {boldSpan('DEC')} property/equipment shall be maintained. This
                  record shall describe the items of property/equipment, the date purchased, and the
                  original cost. A physical inventory shall be conducted of all {boldSpan('DEC')}{' '}
                  property at least annually as of the close of the accounting year. This inventory
                  shall be made a part of the {boldSpan('DEC')} official records.
                </li>
                <li>
                  When the Treasurer is relieved, he/she shall invoice to his/her successor all
                  funds, property, accounts, and records of {boldSpan('DEC')}. The successor shall
                  receive for them. For this purpose, a combined invoice and receipt shall be
                  prepared in quadruplicate with all copies being signed by both parties.
                  Distribution of the signed copies shall be as follows:
                  <ol type="1">
                    <li>Original – filed with a financial statement.</li>
                    <li>Copy – to President.</li>
                    <li>Copy – to newly assigned Treasurer.</li>
                    <li>Copy – to relieving Treasurer.</li>
                  </ol>
                </li>
              </ul>
            </li>
            <li>
              <span className="font-bold">Secretary – </span>
              The Secretary of the {boldSpan('DEC')} plays a crucial role in maintaining accurate
              records and facilitating effective communication within the organization. The specific
              duties of the Secretary include:
              <ul>
                <li>
                  Record-keeping: The Secretary is responsible for taking and maintaining minutes of
                  general meetings of {boldSpan('DEC')}. This includes accurately documenting
                  discussions, decisions, and actions taken during the meetings.
                </li>
                <li>
                  Record Management: The Secretary ensures that all organizational records
                  containing personally identifiable information (PII) are stored securely. PII
                  refers to information about a club member that identifies, links, relates, or is
                  unique to them, such as social security number, driver's license number, age,
                  rank, grade, marital status, race, salary, home/office phone numbers, and other
                  demographic, biometric, personnel, medical, or financial information. These
                  records should be kept in a secure location with restricted access to protect
                  members' privacy and comply with applicable privacy laws.
                </li>
                <li>
                  Waiver of Liability and Assumption of Risk Agreement: The Secretary acquires and
                  retains a copy of each member's Waiver of Liability and Assumption of Risk
                  Agreement. This agreement serves to protect {boldSpan('DEC')} and its members from
                  legal liability and ensures that members acknowledge and understand the inherent
                  risks associated with cycling activities.
                </li>
                <li>
                  Officer Contact Information: The Secretary maintains a comprehensive list of
                  current organizational officers and their personal contact information. This
                  information includes the name, physical address, email address, and daytime phone
                  number of each organizational officer. Having up-to-date contact details allows
                  for effective communication and collaboration among the officers.
                </li>
              </ul>
            </li>
          </ul>
          <p className="font-bold underline">Election of DEC Officers</p>
          <p>
            {boldSpan('Annual Meeting:')} The election of {boldSpan('DEC')} officers shall take
            place at the Annual Meeting, which is held during the General Meeting in January. During
            this meeting, members will have the opportunity to vote on candidates for each office.
          </p>
          <p>
            {boldSpan('Nomination Process:')} Nominations for each office will be called for at the
            December General Meeting. All nominations, along with the nominees' names and offices,
            will be published on the {boldSpan('DEC')} website or through other approved methods
            prior to the Annual Meeting.
          </p>
          <p>
            {boldSpan('Election Procedure:')} During the Annual Meeting, officers shall be elected
            by a majority vote of the voting members present. Each elected officer shall serve from
            the date of election through the next Annual Meeting.
          </p>
          <p>
            {boldSpan('Vacancies:')} In the event of a vacancy occurring during the term of any
            office, the President has the authority to fill the vacancy by appointment. The
            appointment must receive the concurrence of a majority vote of the voting members
            present at the next General Meeting following the occurrence of the vacancy.
          </p>
          <p>
            {boldSpan('Vacancy in the Office of President:')} If a vacancy occurs in the office of
            President, the Vice President shall assume the office of President until a new President
            can be voted in at the next General Meeting.
          </p>
          <p>
            {boldSpan('Limitation on Holding Multiple Offices:')} No person shall occupy more than
            one elected office at any one time. This ensures a fair and balanced distribution of
            responsibilities and promotes equal opportunities for participation among{' '}
            {boldSpan('DEC')} members.
          </p>
        </div>
      </>
    ),
    id: 'Section 5',
  },
  {
    title: () => <>Article VI - Personal Liability</>,
    body: () => (
      <>
        <div className="content">
          <p>
            The collective membership dues and additional income generated by {boldSpan('DEC')} must
            sufficiently cover all expenses, including insurance and other financial obligations. By
            joining {boldSpan('DEC')}, each member acknowledges and accepts equal personal
            liability, as mandated by law, if {boldSpan('DEC')}'s assets are insufficient to fully
            meet all liabilities and obligations. This provision ensures that members understand
            their shared responsibility and commitment to meeting the organization's financial
            obligations.
          </p>
        </div>
      </>
    ),
    id: 'Section 6',
  },
  {
    title: () => <>Article VII – Dissolution</>,
    body: () => (
      <>
        <div className="content">
          <p>Dissolution of the organization shall be upon the initiative of the membership.</p>
          <p>
            Upon the liquidation of all indebtedness, residual assets will be disposed of as
            directed by the Board of Directors. Any remaining funds held in the club account will be
            donated to a local not-for-profit charity as directed by the voting membership.
          </p>
          <p>
            If upon dissolution, liabilities exceed assets, then the excess of liabilities over
            assets shall be paid by the membership. A member is defined as one whose name is carried
            on the active member's roll as of the date of notification. The membership is liable for
            organizational debts in the event the organization's assets are insufficient to
            discharge liabilities. Distribution of residual funds and other assets must not accrue
            to the benefit of any individual member or the membership as a whole.
          </p>
        </div>
      </>
    ),
    id: 'Section 7',
  },
  {
    title: () => <>Article VIII - Budget and Financial Matters</>,
    body: () => (
      <>
        <div className="content">
          <p>
            At the beginning of each Fiscal Year, the Treasurer and the President shall prepare a
            Proposed Budget for all {boldSpan('DEC')} activities and submit the Proposed Budget for
            review by members at the Annual Meeting.
          </p>
          <p>
            The Proposed Budget shall be voted on at the Annual Meeting and if approved by a
            majority vote of the members present, shall be the Final Budget for the Fiscal Year. The
            President shall have the power to establish policies and procedures as needed for the
            implementation of the Final Budget.
          </p>
          <p>
            The President and the Treasurer each shall have the authority to sign individual checks
            or utilize a debit card drawn on {boldSpan('DEC')} accounts.
          </p>
          <p>
            Any two elected officers shall have the power, without the approval of the general
            membership, to make expenditures of $250.00 or less for extraordinary expenses that are
            deemed to be in the best interests of {boldSpan('DEC')} and not included in the Final
            Budget. All other expenditures require the approval of the general membership.
          </p>
          <p>
            The {boldSpan('DEC')} fiscal year shall begin on the first day of January and shall end
            on the last day of December.
          </p>
        </div>
      </>
    ),
    id: 'Section 8',
  },
  {
    title: () => <>Article IX – Parliamentary Authority</>,
    body: () => (
      <>
        <div className="content">
          <p>
            The rules contained in the current edition of Robert's Rules of Order New Revised shall
            govern the organization in all cases to which they are applicable, and I which they are
            not inconsistent with these bylaws, and any special rules of order the organization may
            adopt.
          </p>
        </div>
      </>
    ),
    id: 'Section 9',
  },
  {
    title: () => <>Article X - Affiliations</>,
    body: () => (
      <>
        <div className="content">
          <p>
            At the discretion of the Executive Board, {boldSpan('DEC')} may become an affiliate of
            other cycling-related organizations which may include but are not limited to:
          </p>
          <ul>
            <li>USA Cycling {boldSpan('(USAC)')}</li>
            <li>North Carolina Interscholastic Cycling League {boldSpan('(NCICL)')}</li>
            <li>Down East Dirt Dawgs</li>
            <li>Southern Off-Road Bicycle Association {boldSpan('(SORBA)')}</li>
            <li>Coastal Carolina Off-Road Series {boldSpan('(CCORS)')}</li>
          </ul>
        </div>
      </>
    ),
    id: 'Section 10',
  },
  {
    title: () => <>Article XI - Amendment</>,
    body: () => (
      <>
        <div className="content">
          <p>
            Any proposed amendment shall be approved at a meeting of the Executive Board and
            published on the
            {boldSpan(' DEC')} website or other approved method prior to a General Meeting whereupon
            the proposed amendment may be approved by a 2/3 majority of voting members present.
          </p>
        </div>
      </>
    ),
    id: 'Section 11',
  },
];
