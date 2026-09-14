import Link from "next/link";
import { LegalColumn, Clause } from "@/components/legal";

const SITE = "juliangigola.com";
const EMAIL = "hello@juliangigola.com";

export function TermsColumn() {
  return (
    <LegalColumn
      id="terms"
      title="Terms of Service"
      effective="2026-09-13"
      intro={
        <>
          <p>
            This site shows my photography and film work so that people can
            commission it. Looking is what it is for. Copying is not, and
            feeding it to a machine is not. These terms say that in the detail
            the law needs; the plain version is in the first three clauses.
          </p>
          <p className="mt-4 text-muted-foreground">
            &ldquo;I&rdquo;, &ldquo;me&rdquo; and &ldquo;my&rdquo; mean Julian
            Gigola, the photographer and creative director who owns and operates{" "}
            {SITE} (the &ldquo;Site&rdquo;). &ldquo;You&rdquo; means anyone or
            anything that accesses the Site, whether a person, a company, or
            software acting for either. The{" "}
            <Link href="#privacy" className="underline underline-offset-4">
              Privacy Policy
            </Link>{" "}
            is part of these terms.
          </p>
        </>
      }
    >
      <Clause title="Agreement">
        <p>
          By accessing or using the Site in any way, including through a
          browser, a script, a crawler, an API client, a proxy, a cache, an
          archive, a model, or an agent, you agree to these terms. If you do not
          agree, do not access the Site. If you access it on behalf of a company
          or other organisation, you confirm you have authority to bind it, and
          &ldquo;you&rdquo; includes it.
        </p>
        <p>
          Automated access is agreement too. A program that requests pages from
          the Site is treated as having read and accepted these terms on behalf
          of whoever runs it, and that person or organisation is bound by them.
        </p>
      </Clause>

      <Clause title="Ownership">
        <p>
          Every photograph, film, still, frame, cover, thumbnail, placeholder,
          preview, caption, text, layout, and graphic on the Site
          (&ldquo;Content&rdquo;) is protected by copyright and, where
          applicable, other intellectual property and personality rights. The
          Content is owned by me or licensed to me by the people it was made
          for. All rights are reserved. Nothing on the Site transfers any right,
          title or interest to you, and no licence is granted by implication,
          estoppel or otherwise except the narrow one in clause 3.
        </p>
        <p>
          Many of the photographs show identifiable people, brands, and
          products. Their appearance is governed by releases and agreements that
          cover the work as I published it, and nothing else. Using a photograph
          of a person from this Site for any other purpose may violate their
          rights as well as mine.
        </p>
        <p>
          &ldquo;Julian Gigola&rdquo; and the marks and logos on the Site are
          mine or belong to the clients they name. You may not use any of them
          without written permission.
        </p>
      </Clause>

      <Clause title="What you may do">
        <p>
          You may view the Site in a web browser for your own personal,
          non-commercial reference, and for the ordinary business purpose of
          deciding whether to commission or license my work. Your browser may
          cache pages and images as part of displaying them. You may link to any
          page of the Site. You may share a link to it on social media. That is
          the whole licence.
        </p>
      </Clause>

      <Clause title="What you may not do">
        <p>
          Without my prior written permission you may not, and you may not help
          or allow anyone else to:
        </p>
        <ul>
          <li>
            copy, download, save, screenshot, screen-record, print, extract, or
            otherwise reproduce any Content, in whole or in part, in any medium,
            except the transient copies a browser makes to display a page;
          </li>
          <li>
            publish, post, upload, distribute, transmit, broadcast, display,
            perform, sell, license, or otherwise make any Content available to
            anyone else, on any platform, in any form;
          </li>
          <li>
            modify, crop, recolour, retouch, composite, translate, or create any
            derivative work from any Content;
          </li>
          <li>
            embed, hotlink, frame, mirror, or inline any part of the Site or any
            file served from it on another site, app, or service;
          </li>
          <li>
            remove, alter, or obscure any copyright notice, watermark, credit,
            metadata, or rights-management information, or use any Content from
            which such information has been removed;
          </li>
          <li>
            use any Content for any commercial purpose, including advertising,
            marketing, merchandise, stock, editorial use, mood boards or pitch
            decks shown to clients, or as a reference for commissioned work by
            others;
          </li>
          <li>
            access the Site by any automated means (crawlers, spiders, scrapers,
            bots, headless browsers, download managers, or scripts) for any
            purpose, except a search engine indexing the Site in accordance with
            my robots.txt for the sole purpose of returning links to the Site in
            search results;
          </li>
          <li>
            circumvent, disable, or interfere with any technical measure on the
            Site, including rate limits, access controls, robots directives,
            rights-reservation headers, and the notice that appears when a
            photograph is right-clicked;
          </li>
          <li>
            use the Site or any Content to identify, locate, profile, or contact
            the people shown in the photographs;
          </li>
          <li>
            use the Site in any way that is unlawful, that infringes anyone
            else&rsquo;s rights, or that could damage, overload, or impair the
            Site or the services it runs on.
          </li>
        </ul>
        <p>
          The list is illustrative. Anything not expressly permitted in clause 3
          is prohibited.
        </p>
      </Clause>

      <Clause title="No use for AI or machine learning">
        <p>
          <strong>
            Nothing on this Site may be used to train, fine-tune, test,
            evaluate, benchmark, align, prompt, ground, or otherwise develop or
            operate any artificial intelligence or machine learning system.
          </strong>{" "}
          This applies to every kind of system (image generators, image-to-image
          and video models, multimodal and language models, classifiers,
          embedding and retrieval systems, recommendation systems,
          style-transfer tools, and anything else that learns from data) and to
          every stage of their life: collecting, crawling, scraping,
          downloading, copying, mirroring, caching, labelling, annotating,
          captioning, embedding, vectorising, indexing, tokenising, compiling
          into a dataset or corpus, using as a reference image, or generating
          output that imitates, reproduces, or is derived from the Content or my
          style.
        </p>
        <p>Specifically, and without limiting the above, you may not:</p>
        <ul>
          <li>
            include any Content, any file derived from it, or any description or
            caption of it, in any dataset, corpus, index, or collection used to
            develop or operate any such system, whether public, private,
            commercial, or academic;
          </li>
          <li>
            use any Content as input, context, reference, seed, conditioning, or
            example to any such system, including for &ldquo;image
            prompting&rdquo;, style matching, or generating work in the manner
            of the Content;
          </li>
          <li>
            use any output of any such system that was produced with the help of
            the Content;
          </li>
          <li>
            access the Site with any agent, browser, or tool that will do any of
            the above as a consequence of accessing it.
          </li>
        </ul>
        <p>
          <strong>Reservation of rights.</strong> To the fullest extent
          permitted by law, I expressly reserve all rights in the Content for
          the purposes of text and data mining, machine learning, and artificial
          intelligence, and I opt out of and object to every exception,
          limitation, or licence that would otherwise permit such uses. This is
          an express reservation for the purposes of Article 4(3) of Directive
          (EU) 2019/790 and its implementations in the member states, of the
          corresponding provisions of United Kingdom law, and of any equivalent
          provision anywhere else. The reservation is repeated in
          machine-readable form on every response from the Site (the{" "}
          <code>TDM-Reservation</code> and <code>X-Robots-Tag</code> headers),
          in <code>/.well-known/tdmrep.json</code>, and in{" "}
          <code>/robots.txt</code>. A crawler that ignores those signals is in
          breach of these terms from the first request.
        </p>
        <p>
          <strong>Existing copies.</strong> If any Content has already been
          included in a dataset, index, or model, whether by you or by someone
          you obtained it from, you must delete it, must not use the affected
          dataset or any model trained on it, and must tell me at {EMAIL}. This
          clause does not ratify any past use.
        </p>
        <p>
          <strong>No implied licence.</strong> The absence of a technical
          barrier is not permission. The fact that a file can be fetched, or
          that a page renders in a headless browser, or that an
          &ldquo;opt-out&rdquo; form exists on someone else&rsquo;s platform,
          does not create any right to use the Content for these purposes.
        </p>
      </Clause>

      <Clause title="Licensing and commissions">
        <p>
          I license my work and take commissions. If you want to use a
          photograph, or want photographs made, write to {EMAIL} or use the{" "}
          <Link href="/contact" className="underline underline-offset-4">
            contact page
          </Link>
          . A licence exists only when I have confirmed it in writing and its
          terms (use, territory, duration, fee) have been agreed. Rates shown or
          described on the Site are indicative and are not an offer. Nothing on
          the Site, and no email exchange short of a signed or expressly
          confirmed agreement, creates a contract for licensing or for services.
        </p>
        <p>
          Where a separate written agreement between us exists (a licence, an
          estimate, a booking confirmation, or a contract for services), its
          terms govern that work and prevail over these terms to the extent they
          conflict.
        </p>
      </Clause>

      <Clause title="Enquiries and material you send">
        <p>
          When you send an enquiry, you confirm the information is accurate and
          that you are entitled to send it. You grant me a licence to use what
          you send for the purpose of responding to you, evaluating and
          performing the work discussed, and keeping records of it. How that
          information is stored and for how long is set out in the{" "}
          <Link href="#privacy" className="underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
        <p>
          Do not send anything confidential, anything you do not have the right
          to send, or anything unlawful. The enquiry form is protected against
          automated submission; using it to send spam, to probe the Site, or to
          send anything other than a genuine enquiry is a breach of these terms.
        </p>
      </Clause>

      <Clause title="Third-party services and links">
        <p>
          Films on the Site are embedded from Vimeo and YouTube. Nothing from
          either loads until you press play; when you do, their services and
          their terms and privacy policies apply to that playback. The Site
          links to Instagram, Vimeo, and LinkedIn and may link elsewhere. I am
          not responsible for third-party sites or services, and a link is not
          an endorsement.
        </p>
      </Clause>

      <Clause title="Copyright notices and takedown">
        <p>
          If you believe Content on the Site infringes your rights, write to{" "}
          {EMAIL} with your name and contact details, identification of the work
          you say is infringed, the URL on this Site, a statement of good faith
          belief that the use is not authorised, a statement under penalty of
          perjury that the notice is accurate and that you are the owner or
          authorised to act for the owner, and your physical or electronic
          signature. I respond to notices that meet the requirements of 17
          U.S.C. &sect;512(c)(3) and equivalent laws.
        </p>
        <p>
          If you find my work used elsewhere without permission, I would be
          grateful to hear about it at the same address.
        </p>
      </Clause>

      <Clause title="No warranty">
        <p>
          The Site and the Content are provided &ldquo;as is&rdquo; and
          &ldquo;as available&rdquo;, without warranty of any kind, express or
          implied, including any warranty of merchantability, fitness for a
          particular purpose, title, non-infringement, accuracy, or
          uninterrupted or error-free operation. I may change, suspend, or
          withdraw any part of the Site at any time without notice. Some
          jurisdictions do not allow the exclusion of implied warranties; in
          those, the exclusion applies to the maximum extent permitted.
        </p>
      </Clause>

      <Clause title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, I am not liable to you for any
          indirect, incidental, special, consequential, exemplary, or punitive
          damages, or for any loss of profit, revenue, data, goodwill, or
          opportunity, arising out of or in connection with the Site or these
          terms, however caused and on any theory of liability, even if I was
          told such loss was possible. My total liability for all claims
          relating to the Site is limited to one hundred US dollars (US$100) or
          the amount you paid me for the matter in question, whichever is
          greater. Nothing in these terms limits liability that cannot be
          limited by law, including for fraud or for death or personal injury
          caused by negligence.
        </p>
      </Clause>

      <Clause title="Indemnity">
        <p>
          You will indemnify and hold me harmless from all claims, losses,
          liabilities, damages, costs, and expenses (including reasonable legal
          fees) arising out of your breach of these terms, your use of any
          Content beyond the licence in clause 3, or your violation of any law
          or of anyone&rsquo;s rights. I may assume the defence of any matter
          subject to indemnity, and you will cooperate.
        </p>
      </Clause>

      <Clause title="Enforcement">
        <p>
          A breach of clauses 4 or 5 causes harm that money cannot fully repair,
          so I am entitled to injunctive and other equitable relief to prevent
          or stop it, without posting a bond, in addition to every other remedy.
          Unauthorised use of the Content is also copyright infringement, for
          which the law provides remedies including statutory damages of up to
          US$150,000 per work for wilful infringement, and the removal or
          alteration of rights-management information is separately actionable
          under 17 U.S.C. &sect;1202. I may also suspend or block any access to
          the Site at any time and for any reason.
        </p>
        <p>
          If I bring a claim to enforce these terms and prevail, you will pay my
          reasonable legal fees and costs.
        </p>
      </Clause>

      <Clause title="Governing law and disputes">
        <p>
          These terms, and any dispute arising out of or relating to them or to
          the Site, are governed by the laws of the State of California and the
          federal laws of the United States, without regard to conflict of laws
          rules. The United Nations Convention on Contracts for the
          International Sale of Goods does not apply.
        </p>
        <p>
          Before starting any proceedings, write to me at {EMAIL} describing the
          dispute, and we will each make a good-faith attempt to resolve it
          within thirty days. If that fails, the state and federal courts
          located in San Francisco County, California have exclusive
          jurisdiction, and you consent to their personal jurisdiction and waive
          any objection to venue. I may nevertheless seek injunctive relief, or
          enforce my intellectual property rights, in any court of competent
          jurisdiction.
        </p>
        <p>
          Any claim relating to the Site must be brought within one year after
          it arose, or it is permanently barred. Claims may be brought only in
          an individual capacity, not as a plaintiff or class member in any
          purported class or representative proceeding.
        </p>
      </Clause>

      <Clause title="Changes">
        <p>
          I may change these terms by publishing a new version on this page with
          a new effective date. The version in force is the one published at the
          time of your access. Continued access after a change is acceptance of
          it. Changes do not apply retroactively to a dispute that arose before
          they took effect.
        </p>
      </Clause>

      <Clause title="General">
        <p>
          These terms and the Privacy Policy are the entire agreement between
          you and me about the Site and replace all earlier understandings on
          the subject. If any provision is held unenforceable, it will be
          enforced to the maximum extent permitted and the rest remains in
          force. My not enforcing a provision is not a waiver of it. You may not
          assign these terms; I may assign them to a successor to the Site or my
          business. Clauses 2, 4, 5, 9 to 13, and 16 survive any termination of
          your access. Headings are for reading only. Where these terms are
          translated, the English version governs.
        </p>
      </Clause>

      <Clause title="Contact">
        <p>
          Julian Gigola, San Francisco Bay Area, California.{" "}
          <a href={`mailto:${EMAIL}`} className="underline underline-offset-4">
            {EMAIL}
          </a>
          .
        </p>
      </Clause>
    </LegalColumn>
  );
}
