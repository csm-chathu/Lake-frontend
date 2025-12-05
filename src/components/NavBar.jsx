import { NavLink } from 'react-router-dom';
import './NavBar.css';

const NavBar = () => (
  <nav className="nav">
    <div className="nav__brand">Vet Care</div>
    <ul className="nav__links">
      <li>
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav__link nav__link--active' : 'nav__link')}>
          Dashboard
        </NavLink>
      </li>
      <li>
        <NavLink to="/patients" className={({ isActive }) => (isActive ? 'nav__link nav__link--active' : 'nav__link')}>
          Patients
        </NavLink>
      </li>
      <li>
        <NavLink to="/owners" className={({ isActive }) => (isActive ? 'nav__link nav__link--active' : 'nav__link')}>
          Owners
        </NavLink>
      </li>
      <li>
        <NavLink
          to="/veterinarians"
          className={({ isActive }) => (isActive ? 'nav__link nav__link--active' : 'nav__link')}
        >
          Veterinarians
        </NavLink>
      </li>
      <li>
        <NavLink
          to="/appointments"
          className={({ isActive }) => (isActive ? 'nav__link nav__link--active' : 'nav__link')}
        >
          Appointments
        </NavLink>
      </li>
    </ul>
  </nav>
);

export default NavBar;
