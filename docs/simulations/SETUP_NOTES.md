# Simulation Setup Notes

To run `scripts/simulations/simulateTournament.js`, ensure the following:

1. **Server Running**: Start the Express API (`npm run dev` or equivalent). The script defaults to `http://localhost:3000/api/v1`. Override with `SIM_API_BASE_URL` if needed.
2. **TD Credentials**: Set `TD_EMAIL` and `TD_AUTH_PASSWORD` to a valid tournament director account. For example:
   - PowerShell:
     ```powershell
     $env:TD_EMAIL = "td@example.com"
     $env:TD_AUTH_PASSWORD = "password"
     ```
   - Command Prompt:
     ```cmd
     set TD_EMAIL=td@example.com
     set TD_AUTH_PASSWORD=password
     ```
   - Or create a `.env.simulation` file with the variables and rely on `dotenv` (loaded automatically by the script).
3. **Command**:
   ```bash
   npm run simulate:tournament
   ```

If you continue to receive `TD_EMAIL`/`TD_AUTH_PASSWORD must be set`, double-check the environment variables in the shell where you launch the command.
