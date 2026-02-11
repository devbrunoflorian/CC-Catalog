# Task: Implement Creator Management Features

## Objective
Implement full CRUD functionality for Creators in the Frontend, allowing users to rename and delete creators, leveraging the recently updated backend capabilities.

## Context
The backend has been updated to support:
- updating a creator's name (`update-creator`).
- deleting a creator with optional cascading deletion of sets and items (`delete-creator`).

The current frontend (`CreatorsView.tsx`) only allows editing Patreon and Website URLs. We need to expand this to include renaming and deleting.

## Steps

1.  **Update `CreatorsView.tsx` State & UI for Editing**:
    -   Update `creatorForm` state to include `name`.
    -   In the "Edit Mode" (when `editingCreator` is true):
        -   Add a text input for the Creator Name.
        -   Ensure it defaults to the current name.
    
2.  **Implement Renaming Logic**:
    -   Update `handleUpdateCreator` to send the `name` from `creatorForm` to the backend.
    -   Ensure the local list and details are refreshed upon success.

3.  **Implement Deletion UI & Logic**:
    -   Add a "Delete Creator" button (styled red/danger) in the edit panel.
    -   Implement `handleDeleteCreator` function:
        -   Check if the creator has sets/items (using `creatorDetails.sets`).
        -   Show a confirmation dialog.
        -   If sets exist, ask if the user wants to delete them as well.
        -   Call `delete-creator` IPC with `deleteSets` parameter based on user choice.
        -   On success, clear selection and reload the list.

4.  **Verification**:
    -   Test renaming a creator.
    -   Test deleting an empty creator.
    -   Test deleting a creator with sets (verifying existing confirmation/cleanup).
