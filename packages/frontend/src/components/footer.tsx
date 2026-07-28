import React from 'react'


// Footer con créditos de los desarrolladores — visible solo en la pantalla inicial
export const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer__content">
        <p className="footer__text">
          Desarrollado por{' '}
          <a
            href="https://www.linkedin.com/in/joaquinalejandroguzman"
            target="_blank"
            rel="noopener noreferrer"
            className="footer__link"
          >
            Joaquín Guzmán
          </a>
          {' & '}
          <a
            href="https://www.linkedin.com/in/guilletorres81"
            target="_blank"
            rel="noopener noreferrer"
            className="footer__link"
          >
            Guillermo Torres
          </a>
        </p>
        <p className="footer__copyright">
          © 2026 TrazIA
        </p>
      </div>
    </footer>
  )
}
