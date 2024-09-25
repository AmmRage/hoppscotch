<template>
  <div v-if="fetching" class="flex justify-center"><HoppSmartSpinner /></div>
  <div v-else-if="error" class="text-lg">{{ t('users.load_info_error') }}</div>
  <div v-else-if="user" class="flex flex-col space-y-4">
    <div class="flex gap-x-3">
      <button
        class="p-2 mb-2 rounded-3xl bg-divider"
        @click="router.push('/users')"
      >
        <icon-lucide-arrow-left class="text-xl" />
      </button>

      <div class="flex items-center space-x-3">
        <h1 class="text-lg text-accentContrast">
          {{ userName }}
        </h1>
        <span>/</span>
        <h2 class="text-lg text-accentContrast">
          {{ currentTabName }}
        </h2>
      </div>
    </div>

    <div class="pb-8">
      <HoppSmartTabs v-model="selectedOptionTab" render-inactive-tabs>
        <HoppSmartTab :id="'details'" :label="t('users.details')">
          <UsersDetails
            :user="user"
            @delete-user="deleteUser"
            @make-admin="makeUserAdmin"
            @remove-admin="makeAdminToUser"
            @show-change-password="showChangeUserPasswordModal"
            @update-user-name="(name: string) => (userName = name)"
            class="py-8 px-4"
          />
        </HoppSmartTab>
        <HoppSmartTab :id="'requests'" :label="t('shared_requests.title')">
          <UsersSharedRequests :email="user.email" />
        </HoppSmartTab>
      </HoppSmartTabs>
    </div>

    <HoppSmartConfirmModal
      :show="confirmDeletion"
      :title="t('state.confirm_user_deletion')"
      @hide-modal="confirmDeletion = false"
      @resolve="deleteUserMutation(deleteUserUID)"
    />
    <HoppSmartConfirmModal
      :show="confirmUserToAdmin"
      :title="t('state.confirm_user_to_admin')"
      @hide-modal="confirmUserToAdmin = false"
      @resolve="makeUserAdminMutation(userToAdminUID)"
    />
    <HoppSmartConfirmModal
      :show="confirmAdminToUser"
      :title="t('state.confirm_admin_to_user')"
      @hide-modal="confirmAdminToUser = false"
      @resolve="makeAdminToUserMutation(adminToUserUID)"
    />

    <UsersChangePasswordModal
      v-if="confirmChangeUserPassword"
      @change-password="changeUserPasswordMutation"
      @hide-modal="confirmChangeUserPassword = false"
    />
  </div>
</template>

<script setup lang="ts">
import { useMutation } from '@urql/vue';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { isEmpty } from 'lodash-es';
import { useI18n } from '~/composables/i18n';
import { useToast } from '~/composables/toast';
import { useClientHandler } from '~/composables/useClientHandler';
import {
  DemoteUsersByAdminDocument,
  MakeUsersAdminDocument,
  RemoveUsersByAdminDocument, ChangeUserPasswordDocument,
  UserInfoDocument,
} from '~/helpers/backend/graphql';
import { handleUserDeletion } from '~/helpers/userManagement';

const t = useI18n();
const toast = useToast();

// Tabs
type OptionTabs = 'details' | 'requests';
const selectedOptionTab = ref<OptionTabs>('details');

const currentTabName = computed(() => {
  switch (selectedOptionTab.value) {
    case 'details':
      return t('users.details');
    case 'requests':
      return t('shared_requests.title');
    default:
      return '';
  }
});

const route = useRoute();

const { fetching, error, data, fetchData } = useClientHandler(
  UserInfoDocument,
  {
    uid: route.params.id.toString(),
  }
);

onMounted(async () => {
  await fetchData();
});

const userName = computed({
  get: () => data.value?.infra.userInfo.displayName,
  set: (value) => {
    if (value) {
      data.value!.infra.userInfo.displayName = value;
    }
  },
});

const user = computed({
  get: () => data.value?.infra.userInfo,
  set: (value) => {
    if (value) {
      data.value!.infra.userInfo = value;
    }
  },
});

const confirmUserToAdmin = ref(false);
const userToAdminUID = ref<string | null>(null);
const usersToAdmin = useMutation(MakeUsersAdminDocument);

const makeUserAdmin = (id: string | null) => {
  confirmUserToAdmin.value = true;
  userToAdminUID.value = id;
};

const makeUserAdminMutation = async (id: string | null) => {
  if (!id) {
    confirmUserToAdmin.value = false;
    toast.error(t('state.admin_failure'));
    return;
  }

  const userUIDs = [id];
  const variables = { userUIDs };
  const result = await usersToAdmin.executeMutation(variables);

  if (result.error) {
    toast.error(t('state.admin_failure'));
  } else {
    toast.success(t('state.admin_success'));
    user.value!.isAdmin = true;
  }
  confirmUserToAdmin.value = false;
  userToAdminUID.value = null;
};

// Remove Admin Status from a current admin user
const adminToUser = useMutation(DemoteUsersByAdminDocument);
const confirmAdminToUser = ref(false);
const adminToUserUID = ref<string | null>(null);

const makeAdminToUser = (id: string) => {
  confirmAdminToUser.value = true;
  adminToUserUID.value = id;
};

const makeAdminToUserMutation = async (id: string | null) => {
  if (!id) {
    confirmAdminToUser.value = false;
    toast.error(t('state.remove_admin_failure'));
    return;
  }

  const userUIDs = [id];
  const variables = { userUIDs };
  const result = await adminToUser.executeMutation(variables);
  if (result.error) {
    toast.error(t('state.remove_admin_failure'));
  } else {
    toast.success(t('state.remove_admin_success'));
    user.value!.isAdmin = false;
  }
  confirmAdminToUser.value = false;
  adminToUserUID.value = null;
};


// Change user password
const changeUserPassword = useMutation(ChangeUserPasswordDocument);
const confirmChangeUserPassword = ref(false);
const userUID = ref<string | null>(null);
const newPassword = ref<string | null>(null);
const oldPassword = ref<string | null>(null);

const showChangeUserPasswordModal = (id: string) => {
  confirmChangeUserPassword.value = true;
  userUID.value = id;
};

const changeUserPasswordMutation = async (oldPwd: string, newPwd: string, repeatNewPwd: string) => {
  if (newPwd !== repeatNewPwd) {
    toast.error('Old password does not match');
    return;
  }

  if (isEmpty(oldPwd) || isEmpty(newPwd) || isEmpty(repeatNewPwd) || !oldPwd || !newPwd || !repeatNewPwd || oldPwd === '' || newPwd === '' || repeatNewPwd === '') {
    toast.error('Password cannot be empty');
    return;
  }

  if (oldPwd === newPwd) {
    toast.error('New password cannot be same as old password');
    return;
  }

  if (newPwd.length < 6) {
    toast.error('Password must be at least 6 characters long');
    return;
  }

  if (newPwd.length > 16) {
    toast.error('Password must be at most 16 characters long');
    return;
  }

  if (newPwd.includes(' ')) {
    toast.error('Password cannot contain spaces');
    return;
  }

  if (!userUID) {
    confirmChangeUserPassword.value = false;
    toast.error(`Failed to change password for user`);
    return;
  }

  const variables = {
    userUID: userUID.value,
    newPassword: newPwd,
    oldPassword: oldPwd
  };
  const result = await changeUserPassword.executeMutation(variables);
  if (result.error) {
    toast.error(`error in changing password: ${result.error}`);
  } else {
    if(result.data?.changeUserPassword?.isSuccess){
      toast.success(`Password changed successfully`);
      confirmChangeUserPassword.value = false;
    }
    else{
      toast.error(result.data?.changeUserPassword?.messages[0] ?? "error in changing password");
    }
  }
};

// User Deletion
const router = useRouter();
const userDeletion = useMutation(RemoveUsersByAdminDocument);
const confirmDeletion = ref(false);
const deleteUserUID = ref<string | null>(null);

const deleteUser = (id: string) => {
  confirmDeletion.value = true;
  deleteUserUID.value = id;
};

const deleteUserMutation = async (id: string | null) => {
  if (!id) {
    confirmDeletion.value = false;
    toast.error(t('state.delete_user_failure'));
    return;
  }
  const userUIDs = [id];
  const variables = { userUIDs };
  const result = await userDeletion.executeMutation(variables);

  if (result.error) {
    toast.error(t('state.delete_user_failure'));
  } else {
    const deletedUser = result.data?.removeUsersByAdmin || [];
    handleUserDeletion(deletedUser);

    const { isDeleted } = deletedUser[0];
    if (isDeleted) router.push('/users');
  }

  confirmDeletion.value = false;
  deleteUserUID.value = null;
};
</script>
