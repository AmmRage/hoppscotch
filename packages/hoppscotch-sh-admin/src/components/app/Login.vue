<template>
  <div v-if="nonAdminUser" class="text-center">
    {{ t('state.non_admin_logged_in') }}
    <span @click="logout()" class="text-red-500 cursor-pointer underline">{{
      t('state.sign_out')
    }}</span>
    {{ t('state.login_as_admin') }}
  </div>

  <div v-else-if="fetching" class="flex justify-center py-6">
    <HoppSmartSpinner />
  </div>

  <div v-else-if="error">
    <p class="text-xl">{{ t('state.error') }}</p>
  </div>

  <div v-else class="flex flex-1 flex-col">
    <div
      class="p-6 bg-primaryLight rounded-lg border border-primaryDark shadow"
    >
      <div
        v-if="mode === 'sign-in' && allowedAuthProviders"
        class="flex flex-col space-y-2"
      >
        <HoppSmartItem
          v-if="allowedAuthProviders.includes('GITHUB')"
          :loading="signingInWithGitHub"
          :icon="IconGithub"
          :label="t('state.continue_github')"
          class="!items-center"
          @click="signInWithGithub"
        />
        <HoppSmartItem
          v-if="allowedAuthProviders.includes('GOOGLE')"
          :loading="signingInWithGoogle"
          :icon="IconGoogle"
          :label="t('state.continue_google')"
          @click="signInWithGoogle"
        />
        <HoppSmartItem
          v-if="allowedAuthProviders.includes('MICROSOFT')"
          :loading="signingInWithMicrosoft"
          :icon="IconMicrosoft"
          :label="t('state.continue_microsoft')"
          @click="signInWithMicrosoft"
        />
        <HoppSmartItem
          v-if="allowedAuthProviders.includes('EMAIL')"
          :icon="IconEmail"
          :label="t('state.continue_email')"
          @click="mode = 'email'"
        />
        <HoppSmartItem
          v-if="allowedAuthProviders.includes('EMAIL')"
          :icon="IconUserPlus"
          label="Continue with username password"
          @click="mode = 'initial'"
        />
      </div>
      <form
        v-if="mode === 'email' && allowedAuthProviders"
        class="flex flex-col space-y-4"
        @submit.prevent="signInWithEmail"
      >
        <HoppSmartInput
          v-model="form.email"
          type="email"
          placeholder=" "
          input-styles="floating-input"
          label="Email"
        />

        <HoppButtonPrimary
          :loading="signingInWithEmail"
          type="submit"
          :label="t('state.send_magic_link')"
        />
      </form>

      <form
        v-if="mode === 'initial'"
        class="flex flex-col space-y-4"
        @submit.prevent="initialRegisterByUsernamePassword"
      >
        <HoppSmartInput
          v-model="form.username"
          type="initial"
          placeholder="your email as username"
          input-styles="floating-input"
        />

        <HoppSmartInput
          v-model="form.password"
          type="password"
          placeholder="password"
          input-styles="floating-input"
        />

        <HoppButtonPrimary
          :loading="registerByUsernamePassword"
          type="submit"
          label="Register"
        />
      </form>
      <div v-if="!allowedAuthProviders">
        <p>{{ t('state.require_auth_provider') }}</p>
        <p>{{ t('state.configure_auth') }}</p>
        <div class="mt-5">
          <a
            href="https://docs.hoppscotch.io/documentation/self-host/getting-started"
          >
            <HoppButtonSecondary
              outline
              filled
              blank
              :icon="IconFileText"
              :label="t('state.self_host_docs')"
            />
          </a>
        </div>
      </div>
      <!--  email sent for invited user and new user after install and register first user  -->
      <div v-if="mode === 'email-sent'" class="flex flex-col px-4">
        <div class="flex flex-col items-center justify-center max-w-md">
          <icon-lucide-inbox class="w-6 h-6 text-accent" />
          <h3 class="my-2 text-lg text-center">
            {{ t('state.magic_link_success') }} {{ form.email ?? form.username }}
          </h3>
          <p class="text-center">
            {{ t('state.magic_link_success') }} {{ form.email }}.
            {{ t('state.magic_link_sign_in') }}
          </p>
        </div>
      </div>
      <!--  after user not admin login  -->
      <div v-if="mode === 'not-admin'" class="flex flex-col px-4">
        <div class="flex flex-col items-center justify-center max-w-md">
          <icon-lucide-file-warning class="w-6 h-6 text-amber-500" />
          <h3 class="my-2 text-lg text-center ">
            {{ t('state.not_admin') }}
          </h3>
<!--          <p class="text-center">-->
<!--            {{ t('state.magic_link_success') }} {{ form.email }}.-->
<!--            {{ t('state.magic_link_sign_in') }}-->
<!--          </p>-->
        </div>
      </div>
      <!--  when user try log in with email not invited  -->
      <div v-if="mode === 'not-invited'" class="flex flex-col px-4">
        <div class="flex flex-col items-center justify-center max-w-md">
          <icon-lucide-x class="w-6 h-6 text-rose-600" />
          <h3 class="my-2 text-lg text-center">
            {{ t('state.not-invited') }}
          </h3>
<!--          <p class="text-center">-->
<!--            {{ t('state.magic_link_success') }} {{ form.email }}.-->
<!--            {{ t('state.magic_link_sign_in') }}-->
<!--          </p>-->
        </div>
      </div>
      <!--   admin logged in   -->
      <div v-if="mode === 'admin-logged-in'" class="flex flex-col px-4">
        <div class="flex flex-col items-center justify-center max-w-md">
          <icon-lucide-crown class="w-6 h-6 text-yellow-400" />
          <h3 class="my-2 text-lg text-center">
            {{ t('state.admin-logged-in') }}
          </h3>
        </div>
      </div>
    </div>

    <section class="mt-16">
      <div
        v-if="
          mode === 'sign-in' &&
          tosLink &&
          privacyPolicyLink &&
          allowedAuthProviders
        "
        class="text-secondaryLight text-tiny"
      >
        {{ t('state.sign_in_agreement') }}
        <HoppSmartAnchor
          class="link"
          :to="tosLink"
          blank
          label="Terms of Service"
        />
        {{ t('state.and') }}
        <HoppSmartAnchor
          class="link"
          :to="privacyPolicyLink"
          blank
          :label="t('state.privacy_policy')"
        />
      </div>
      <div v-if="mode === 'email'">
        <HoppButtonSecondary
          :label="t('state.sign_in_options')"
          :icon="IconArrowLeft"
          class="!p-0"
          @click="mode = 'sign-in'"
        />
      </div>
      <div
        v-if="mode === 'email-sent'"
        class="flex justify-between flex-1 text-secondaryLight"
      >
        <HoppSmartAnchor
          class="link"
          :label="t('state.reenter_email')"
          :icon="IconArrowLeft"
          @click="mode = 'email'"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from '~/composables/i18n';
import { useToast } from '~/composables/toast';
import { auth } from '~/helpers/auth';
import { setLocalConfig } from '~/helpers/localpersistence';
import IconEmail from '~icons/auth/email';
import IconGithub from '~icons/auth/github';
import IconGoogle from '~icons/auth/google';
import IconMicrosoft from '~icons/auth/microsoft';
import IconArrowLeft from '~icons/lucide/arrow-left';
import IconFileText from '~icons/lucide/file-text';
import IconUserPlus from '~icons/lucide/user-plus';

const t = useI18n();
const toast = useToast();

const tosLink = import.meta.env.VITE_APP_TOS_LINK;
const privacyPolicyLink = import.meta.env.VITE_APP_PRIVACY_POLICY_LINK;

const form = ref({
  email: '',
  username: '',
  password: '',
});
const fetching = ref(false);
const error = ref(false);
const signingInWithGoogle = ref(false);
const signingInWithGitHub = ref(false);
const signingInWithMicrosoft = ref(false);
const signingInWithEmail = ref(false);
const registerByUsernamePassword = ref(false);
const mode = ref('sign-in');
const nonAdminUser = ref(false);

const allowedAuthProviders = ref<string[]>([]);

onMounted(async () => {
  const user = auth.getCurrentUser();
  if (user && !user.isAdmin) {
    nonAdminUser.value = true;
  }
  allowedAuthProviders.value = await getAllowedAuthProviders();
});

const signInWithGoogle = () => {
  signingInWithGoogle.value = true;

  try {
    auth.signInUserWithGoogle();
  } catch (e) {
    console.error(e);
    toast.error(t('state.google_signin_failure'));
  }

  signingInWithGoogle.value = false;
};

const signInWithGithub = () => {
  signingInWithGitHub.value = true;

  try {
    auth.signInUserWithGithub();
  } catch (e) {
    console.error(e);
    toast.error(t('state.github_signin_failure'));
  }

  signingInWithGitHub.value = false;
};

const signInWithMicrosoft = () => {
  signingInWithMicrosoft.value = true;

  try {
    auth.signInUserWithMicrosoft();
  } catch (e) {
    console.error(e);
    toast.error(t('state.microsoft_signin_failure'));
  }

  signingInWithMicrosoft.value = false;
};

const signInWithEmail = async () => {
  signingInWithEmail.value = true;
  try {
    await auth.signInWithEmail(form.value.email);
    mode.value = 'email-sent';
    setLocalConfig('emailForSignIn', form.value.email);
  } catch (e) {
    console.error(e);
    toast.error(t('state.email_signin_failure'));
  }
  signingInWithEmail.value = false;
};


const initialRegisterByUsernamePassword = async () => {
  registerByUsernamePassword.value = true;
  try {
    const message = await auth.createOrLoginUserByEmailPassword(form.value.username, form.value.password);
    console.log(`login message: ${message}`);
    if (message === 'not-admin') {
      mode.value = 'not-admin';
    }
    else if (message === 'not-invited') {
      mode.value = 'not-invited';
    }
    else if (message === 'admin-logged-in') {
      mode.value = 'admin-logged-in';
      setLocalConfig('emailForSignIn', form.value.username);
      window.location.href = import.meta.env.VITE_ADMIN_URL
    }
    else {
      mode.value = 'email-sent';
      setLocalConfig('emailForSignIn', form.value.username);
      window.location.href = import.meta.env.VITE_ADMIN_URL
    }
  } catch (e) {
    console.error(e);
    toast.error(t('state.email_signin_failure'));
  }
  registerByUsernamePassword.value = false;
};

const getAllowedAuthProviders = async () => {
  fetching.value = true;
  try {
    const res = await auth.getAllowedAuthProviders();
    return res;
  } catch (e) {
    error.value = true;
    toast.error(t('state.error_auth_providers'));
  } finally {
    fetching.value = false;
  }
};

const logout = async () => {
  try {
    await auth.signOutUser();
    window.location.reload();
    toast.success(t('state.logged_out'));
  } catch (e) {
    console.error(e);
    toast.error(t('state.error'));
  }
};
</script>
