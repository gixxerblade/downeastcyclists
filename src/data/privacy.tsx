import Link from "next/link";
import React from "react";

export const privacy = [
  {
    title: () => <>Information Collection And Use</>,
    body: () => (
      <>
        <div className="content">
          <p>
            While using our Service, we may ask you to provide us with certain personally
            identifiable information that can be used to contact or identify you. Personally
            identifiable information (“Personal Information”) may include, but is not limited to:
          </p>
          <ul>
            <li>Name</li>
            <li>Email address</li>
          </ul>
        </div>
      </>
    ),
    id: "1",
  },
  {
    title: () => <>Log Data</>,
    body: () => (
      <>
        <div className="content">
          <p>
            We collect information that your browser sends whenever you visit our Service (“Log
            Data”). This Log Data may include information such as your computer’s Internet Protocol
            (“IP”) address, browser type, browser version, the pages of our Service that you visit,
            the time and date of your visit, the time spent on those pages and other statistics.
          </p>
        </div>
      </>
    ),
    id: "2",
  },
  {
    title: () => <>Cookies</>,
    body: () => (
      <>
        <div className="content">
          <p>
            Cookies are files with small amount of data, which may include an anonymous unique
            identifier. Cookies are sent to your browser from a web site and stored on your
            computer’s hard drive.
          </p>
          <br />
          <p>
            We use “cookies” to collect information. You can instruct your browser to refuse all
            cookies or to indicate when a cookie is being sent. However, if you do not accept
            cookies, you may not be able to use some portions of our Service.
          </p>
        </div>
      </>
    ),
    id: "3",
  },
  {
    title: () => <>Service Providers</>,
    body: () => (
      <>
        <div className="conete">
          <p>
            We may employ third party companies and individuals to facilitate our Service, to
            provide the Service on our behalf, to perform Service-related services or to assist us
            in analyzing how our Service is used.
          </p>
          <br />
          <p>
            These third parties have access to your Personal Information only to perform these tasks
            on our behalf and are obligated not to disclose or use it for any other purpose.
          </p>
        </div>
      </>
    ),
    id: "4",
  },
  {
    title: () => <>Security</>,
    body: () => (
      <>
        <div className="content">
          <p>
            The security of your Personal Information is important to us, but remember that no
            method of transmission over the Internet, or method of electronic storage is 100%
            secure. While we strive to use commercially acceptable means to protect your Personal
            Information, we cannot guarantee its absolute security.
          </p>
        </div>
      </>
    ),
    id: "5",
  },
  {
    title: () => <>Links To Other Sites</>,
    body: () => (
      <>
        <div className="content">
          <p>
            Our Service may contain links to other sites that are not operated by us. If you click
            on a third party link, you will be directed to that third party’s site. We strongly
            advise you to review the Privacy Policy of every site you visit.
          </p>
          <br />
          <p>
            We have no control over, and assume no responsibility for the content, privacy policies
            or practices of any third party sites or services.
          </p>
        </div>
      </>
    ),
    id: "6",
  },
  {
    title: () => <>Children’s Privacy</>,
    body: () => (
      <>
        <div className="content">
          <p>Our Service does not address anyone under the age of 18 (“Children”).</p>
          <br />
          <p>
            We do not knowingly collect personally identifiable information from children under 18.
            If you are a parent or guardian and you are aware that your child has provided us with
            Personal Information, please contact us. If we discover that a child under 18 has
            provided us with Personal Information, we will delete such information from our servers
            immediately.
          </p>
        </div>
      </>
    ),
    id: "7",
  },
  {
    title: () => <>Compliance With Laws</>,
    body: () => (
      <>
        <div className="content">
          <p>
            We will disclose your Personal Information where required to do so by law or subpoena.
          </p>
        </div>
      </>
    ),
    id: "8",
  },
  {
    title: () => <>Changes To This Privacy Policy</>,
    body: () => (
      <>
        <div className="content">
          <p>
            We may update our Privacy Policy from time to time. We will notify you of any changes by
            posting the new Privacy Policy on this page.
          </p>
          <br />
          <p>
            You are advised to review this Privacy Policy periodically for any changes. Changes to
            this Privacy Policy are effective when they are posted on this page.
          </p>
        </div>
      </>
    ),
    id: "9",
  },
  {
    title: () => <>Contact Us</>,
    body: () => (
      <>
        <div className="content">
          <p>
            If you have any questions about this Privacy Policy, please{" "}
            <Link href="/contact">contact us</Link>
          </p>
        </div>
      </>
    ),
    id: "10",
  },
];
