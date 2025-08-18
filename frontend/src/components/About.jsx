export default function About({ refProp }) {
  return (
    <section id="about" ref={refProp} className="section">
      <div className="container">
        <h2>קצת עלינו</h2>
        <p>
          היי, אני אגם, אני בת 20, ובשנים האחרונות כתבתי שלושה ספרים שהם בעצם יומנים אישיים- מסע קטן שלי דרך התבגרות, חברות ואהבה, וגם פרידה וגילוי עצמי. לצד המילים נולדו גם התכשיטים שלי- צמיד וטבעות עם מסרים מעצימים שמזכירים לכל אחת את הכוח, האור והייחודיות שבה. הקמתי את החנות הזו כדי לשתף אתכם במה שנתן לי השראה וכוח, בתקווה שתמצאו כאן משהו שילווה גם אתכם בדרך שלכם.
        </p>
        <p>
          מזמינה אתכם לראות עוד גם בעמוד האינסטגרם שלי:{' '}
          <a 
            href="https://www.instagram.com/secril1/profilecard/?igsh=cHJvMHV4ejY5dHQ3" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#3b82f6', textDecoration: 'underline' }}
          >
            @secril1
          </a>
        </p>
      </div>
    </section>
  );
}
