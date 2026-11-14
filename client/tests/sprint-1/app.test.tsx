import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../src/App';

describe('Client Foundation & App Rendering', () => {
  it('renders welcome heading', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Welcome to Appointly/i)).toBeDefined();
    });
  });
});
