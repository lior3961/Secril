export default function About({ refProp }) {
  return (
    <section id="about" ref={refProp} className="section">
      <div className="container">
        <h2>קצת עלינו</h2>
        <p>
          Secril הוקמה מתוך אהבה לאסתטיקה, פונקציונליות ושירות. אנחנו משלבים איכות,
          עיצוב ונוחות—ומתחייבים לשקיפות מלאה לאורך כל תהליך הרכישה.
        </p>
      </div>
    </section>
  );
}
