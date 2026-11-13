import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/App';

describe('Client Foundation & App Rendering', () => {
  it('renders welcome heading', () => {
    render(<App />);
    expect(screen.getByText(/Welcome to Appointly/i)).toBeDefined();
  });
});
