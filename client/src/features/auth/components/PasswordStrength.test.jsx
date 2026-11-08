import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PasswordStrength from './PasswordStrength';

describe('PasswordStrength', () => {
  it('shows the requirement checklist but no meter for an empty password', () => {
    render(<PasswordStrength password="" />);
    expect(screen.queryByText(/password strength/i)).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Password requirements' })).toBeInTheDocument();
    expect(screen.getAllByText('(not met yet)')).toHaveLength(4);
  });

  it('shows a textual label so colour is never the only signal', () => {
    render(<PasswordStrength password="Kq7mWz2xPv9L" />);
    expect(screen.getByText(/password strength/i)).toHaveTextContent('Fair');
  });

  it('reports Weak for a short password and marks the unmet rules', () => {
    render(<PasswordStrength password="abc" />);
    expect(screen.getByText(/password strength/i)).toHaveTextContent('Weak');

    const list = screen.getByRole('list', { name: 'Password requirements' });
    const lengthRule = within(list).getByText('At least 12 characters').closest('li');
    expect(within(lengthRule).getByText('(not met yet)')).toBeInTheDocument();

    const lowercaseRule = within(list).getByText('One lowercase letter').closest('li');
    expect(within(lowercaseRule).getByText('(met)')).toBeInTheDocument();
  });

  it('marks every rule met for a valid password', () => {
    render(<PasswordStrength password="Kq7mWz2xPv9L" />);
    expect(screen.getAllByText('(met)')).toHaveLength(4);
    expect(screen.queryByText('(not met yet)')).not.toBeInTheDocument();
  });

  it('reports Strong for a long, varied password', () => {
    render(<PasswordStrength password="Tr0ub4dor&3xylophone" />);
    expect(screen.getByText(/password strength/i)).toHaveTextContent('Strong');
  });

  it('uses personal details to lower the rating', () => {
    const { rerender } = render(<PasswordStrength password="Kq7mWz2xPv9Lnoorul" />);
    expect(screen.getByText(/password strength/i)).toHaveTextContent('Good');

    rerender(<PasswordStrength password="Kq7mWz2xPv9Lnoorul" personal={['noorul']} />);
    expect(screen.getByText(/password strength/i)).toHaveTextContent('Fair');
  });
});
